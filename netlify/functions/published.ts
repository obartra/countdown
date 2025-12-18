import type { Handler } from "@netlify/functions";
import { storageClient } from "./lib/storage";
import { normalizeSlugInput } from "../../src/lib/slug";
import { hashPassword } from "./lib/hash";
import {
  checkAttemptLimit,
  recordFailedAttempt,
  clearAttempts,
} from "./lib/rateLimit";
import { logAdminAction, logDelete } from "./lib/logger";
import { checkAdminAuth } from "./lib/adminAuth";

type HandlerEvent = Parameters<Handler>[0];

type VerifyPayload = {
  password?: string;
};

const jsonResponse = (
  statusCode: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...(headers ?? {}),
  },
  body: JSON.stringify(body),
});

const methodNotAllowed = () =>
  jsonResponse(405, { error: "Method not allowed" });

const notFound = () => jsonResponse(404, { error: "Not found" });

const unauthorized = () => jsonResponse(401, { error: "Unauthorized" });

const attemptLimitResponse = (resetAt: number, message: string) => {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt - Date.now()) / 1000),
  );
  return jsonResponse(
    429,
    { error: message },
    { "Retry-After": retryAfterSeconds.toString() },
  );
};

type DeletePayload = {
  password?: string;
};

const parseJsonBody = <T extends { password?: string }>(
  body: string | null,
): T => {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

const handler: Handler = async (event) => {
  const slugParam = event.queryStringParameters?.slug;
  if (!slugParam) {
    return notFound();
  }

  const slug = normalizeSlugInput(slugParam);
  if (!slug) {
    return notFound();
  }

  const requiresPasswordFromMeta = (meta: { ownerHash?: string } | null) =>
    Boolean(meta?.ownerHash);

  if (event.httpMethod === "POST") {
    if (event.queryStringParameters?.action !== "verify") {
      return methodNotAllowed();
    }

    const meta = await storageClient.readMeta(slug);
    if (!meta || !meta.published) {
      return notFound();
    }

    if (meta.ownerHash) {
      const attemptStatus = await checkAttemptLimit(slug);
      if (!attemptStatus.allowed) {
        const retryMinutes = Math.ceil(
          Math.max(1, (attemptStatus.resetAt - Date.now()) / 1000 / 60),
        );
        return attemptLimitResponse(
          attemptStatus.resetAt,
          `Too many failed attempts. Try again in ${retryMinutes} minute${
            retryMinutes === 1 ? "" : "s"
          }.`,
        );
      }
      const body = parseJsonBody<VerifyPayload>(event.body);
      if (!body.password) {
        await recordFailedAttempt(slug);
        return unauthorized();
      }
      if (hashPassword(body.password) !== meta.ownerHash) {
        await recordFailedAttempt(slug);
        return unauthorized();
      }

      await clearAttempts(slug);
    }

    return jsonResponse(200, {
      slug,
      verified: true,
      requiresPassword: requiresPasswordFromMeta(meta),
    });
  }

  if (event.httpMethod === "GET") {
    const meta = await storageClient.readMeta(slug);
    if (!meta || !meta.published) {
      return notFound();
    }

    const now = Date.now();
    if (meta.expiresAt && meta.expiresAt <= now) {
      await storageClient.deleteMeta(slug);
      await storageClient.deletePayload(slug);
      return notFound();
    }

    const payload = await storageClient.readPayload(slug);
    if (!payload) {
      return notFound();
    }

    const responseBody = {
      slug,
      payload,
      meta: {
        slug: meta.slug,
        createdAt: meta.createdAt,
        timeMs: meta.timeMs,
        expiresAt: meta.expiresAt,
        published: meta.published,
        requiresPassword: requiresPasswordFromMeta(meta),
      },
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responseBody),
    };
  }

  /**
   * DELETE /v/:slug
   * - Owner password required when set.
   * - Admin override: supply x-admin-override: <ADMIN_SECRET> to bypass password and receive { adminOverride: true } in the response.
   */
  if (event.httpMethod === "DELETE") {
    const meta = await storageClient.readMeta(slug);
    if (!meta || !meta.published) {
      return notFound();
    }

    const adminOverrideAuth = checkAdminAuth(event.headers, {
      headerName: "x-admin-override",
    });
    const adminOverride = adminOverrideAuth.authorized;

    const providedOverrideHeader =
      event.headers["x-admin-override"] || event.headers["X-Admin-Override"];

    if (providedOverrideHeader && !adminOverride) {
      await logAdminAction({
        action: "delete-override-failed",
        slug,
        outcome: "unauthorized",
      });
      return unauthorized();
    }

    if (meta.ownerHash) {
      if (adminOverride) {
        await storageClient.deleteMeta(slug);
        await storageClient.deletePayload(slug);
        await clearAttempts(slug);
        await logDelete({ slug, outcome: "admin_override" });
        await logAdminAction({
          action: "delete",
          slug,
          actor: "admin_override",
        });
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, deleted: true, adminOverride: true }),
        };
      }

      const attemptStatus = await checkAttemptLimit(slug);
      if (!attemptStatus.allowed) {
        const retryMinutes = Math.ceil(
          Math.max(1, (attemptStatus.resetAt - Date.now()) / 1000 / 60),
        );
        await logDelete({ slug, outcome: "locked_out" });
        return attemptLimitResponse(
          attemptStatus.resetAt,
          `Too many failed attempts. Try again in ${retryMinutes} minute${
            retryMinutes === 1 ? "" : "s"
          }.`,
        );
      }
      const body = parseJsonBody<DeletePayload>(event.body);
      if (!body.password) {
        await recordFailedAttempt(slug);
        await logDelete({ slug, outcome: "failed_password" });
        return unauthorized();
      }
      if (hashPassword(body.password) !== meta.ownerHash) {
        await recordFailedAttempt(slug);
        await logDelete({ slug, outcome: "failed_password" });
        return unauthorized();
      }
    }

    await storageClient.deleteMeta(slug);
    await storageClient.deletePayload(slug);
    await clearAttempts(slug);
    await logDelete({ slug, outcome: "success" });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, deleted: true }),
    };
  }

  return methodNotAllowed();
};

export { handler };

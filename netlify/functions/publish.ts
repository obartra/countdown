import type { Handler } from "@netlify/functions";
import { storageClient, PublicationMeta } from "./lib/storage";
import { normalizeSlugInput, generateRandomSlug } from "../../src/lib/slug";
import { hashPassword } from "./lib/hash";
import {
  checkRateLimit,
  hashIp,
  recordPublish,
  type RateLimitStatus,
} from "./lib/rateLimit";
import { logPublish } from "./lib/logger";

const MAX_FUTURE_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const ANON_SLUG_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CUSTOM_SLUG_TTL_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const MAX_GENERATION_ATTEMPTS = 8;

type PublishRequest = {
  slug?: string;
  canonicalSearch?: string;
  password?: string;
};

const parseBody = (body: string | null): PublishRequest | null => {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const ensureSlug = async (preferred?: string | null) => {
  if (preferred) return preferred;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateRandomSlug(8);
    const existing = await storageClient.readMeta(candidate);
    if (!existing || !existing.published) {
      return candidate;
    }
  }
  throw new Error("Failed to generate available slug");
};

type HandlerEvent = Parameters<Handler>[0];

const buildBaseUrl = (event: HandlerEvent) => {
  const originHeader = event.headers.origin || event.headers.Origin;
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      return `${originUrl.protocol}//${originUrl.host}`;
    } catch {
      // Ignore malformed origin header.
    }
  }

  const refererHeader =
    event.headers.referer ||
    event.headers.referrer ||
    event.headers.Referer ||
    event.headers.Referrer;
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      return `${refererUrl.protocol}//${refererUrl.host}`;
    } catch {
      // Ignore malformed referer header.
    }
  }

  const forwardedHost =
    event.headers["x-forwarded-host"] || event.headers["X-Forwarded-Host"];
  const protoHeader =
    event.headers["x-forwarded-proto"] ||
    event.headers["x-forwarded-protocol"] ||
    event.headers["X-Forwarded-Proto"] ||
    event.headers["X-Forwarded-Protocol"];
  const host = forwardedHost || event.headers.host || "localhost:8080";
  const trimmedProto = protoHeader ? protoHeader.split(",")[0].trim() : "";
  const resolvedProto =
    trimmedProto ||
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${resolvedProto}://${host}`;
};

const buildResponse = (
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
  buildResponse(405, { error: "Method not allowed" });

const badRequest = (message: string, headers?: Record<string, string>) =>
  buildResponse(400, { error: message }, headers);

const conflictResponse = (message: string, headers?: Record<string, string>) =>
  buildResponse(409, { error: message }, headers);

const unauthorizedResponse = (
  message: string,
  headers?: Record<string, string>,
) => buildResponse(401, { error: message }, headers);

const buildRateLimitHeaders = (status?: RateLimitStatus) => {
  if (!status) return {};
  return {
    "X-RateLimit-Limit": status.limit.toString(),
    "X-RateLimit-Remaining": status.remaining.toString(),
    "X-RateLimit-Reset": Math.floor(status.resetAt / 1000).toString(),
  };
};

const rateLimitExceeded = (status: RateLimitStatus, message: string) => {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((status.resetAt - Date.now()) / 1000),
  );
  return buildResponse(
    429,
    { error: message },
    {
      ...buildRateLimitHeaders(status),
      "Retry-After": retryAfterSeconds.toString(),
    },
  );
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  const clientIp =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const ipHash = clientIp ? hashIp(clientIp) : undefined;
  const body = parseBody(event.body);
  type PublishSlugType = "anonymous" | "custom" | "unknown";
  const slugType: PublishSlugType = body
    ? body.slug
      ? "custom"
      : "anonymous"
    : "unknown";

  const PUBLISH_LIMITS = { hourly: 10, daily: 100 };
  const limitStatus = await checkRateLimit(clientIp, PUBLISH_LIMITS);
  if (!limitStatus.allowed) {
    await logPublish({
      ipHash,
      slugType,
      outcome: "rate_limited",
    });
    const retryMinutes = Math.ceil(
      Math.max(1, (limitStatus.resetAt - Date.now()) / 1000 / 60),
    );
    return rateLimitExceeded(
      limitStatus,
      `Too many publishes. Try again in ${retryMinutes} minute${
        retryMinutes === 1 ? "" : "s"
      }.`,
    );
  }

  const recordedStatus = await recordPublish(clientIp, PUBLISH_LIMITS);
  const headers = buildRateLimitHeaders(recordedStatus);
  const respondWithLog = async (
    response: ReturnType<typeof buildResponse>,
    outcome: string,
    slugValue?: string,
  ) => {
    await logPublish({
      ipHash,
      slugType,
      outcome,
      slug: slugValue,
    });
    return response;
  };

  if (!body) {
    return respondWithLog(
      badRequest("Invalid JSON body", headers),
      "invalid_json",
    );
  }

  const canonicalSearch = (body.canonicalSearch || "").replace(/^\?/, "");
  if (!canonicalSearch) {
    return respondWithLog(
      badRequest("canonicalSearch is required", headers),
      "invalid_payload",
    );
  }

  const requestedSlug = normalizeSlugInput(body.slug);
  if (body.slug && !requestedSlug) {
    return respondWithLog(
      badRequest("Invalid slug format", headers),
      "invalid_payload",
    );
  }

  if (body.slug && !body.password) {
    return respondWithLog(
      badRequest("Password required for custom slug", headers),
      "invalid_payload",
    );
  }

  const slug = await ensureSlug(requestedSlug);

  const params = new URLSearchParams(canonicalSearch);
  const timeValue = params.get("time");
  if (!timeValue) {
    return respondWithLog(
      badRequest("time parameter is required", headers),
      "invalid_payload",
    );
  }

  const timeMs = Date.parse(timeValue);
  if (Number.isNaN(timeMs)) {
    return respondWithLog(
      badRequest("time is invalid", headers),
      "invalid_payload",
    );
  }

  const now = Date.now();
  if (timeMs > now + MAX_FUTURE_MS) {
    return respondWithLog(
      badRequest("time exceeds five-year limit", headers),
      "invalid_payload",
    );
  }

  const requiresPassword = Boolean(body.password);
  const slugTTL = requiresPassword ? CUSTOM_SLUG_TTL_MS : ANON_SLUG_TTL_MS;
  const expiresAt = now + slugTTL;
  const ownerHash = requiresPassword ? hashPassword(body.password!) : undefined;
  const meta: PublicationMeta = {
    slug,
    createdAt: now,
    timeMs,
    expiresAt,
    published: true,
    ownerHash,
  };

  const existing = await storageClient.readMeta(slug);
  if (existing && existing.published) {
    if (!existing.ownerHash) {
      return respondWithLog(
        conflictResponse("Slug already published", headers),
        "conflict",
        slug,
      );
    }

    if (!ownerHash || ownerHash !== existing.ownerHash) {
      return respondWithLog(
        unauthorizedResponse("Unauthorized", headers),
        "unauthorized",
        slug,
      );
    }
  }

  await storageClient.writeMeta(slug, meta);
  await storageClient.writePayload(slug, canonicalSearch);

  const baseUrl = buildBaseUrl(event);
  const shortUrl = `${baseUrl}/v/${slug}`;
  const longUrl = canonicalSearch
    ? `${baseUrl}/?${canonicalSearch}`
    : `${baseUrl}/`;

  return respondWithLog(
    buildResponse(
      200,
      {
        slug,
        shortUrl,
        longUrl,
        expiresAt,
      },
      headers,
    ),
    "success",
    slug,
  );
};

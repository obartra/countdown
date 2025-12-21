import type { Handler } from "@netlify/functions";
import { normalizeSlugInput } from "../../src/lib/slug";
import { writeJsonBlob } from "./lib/blobStorage";
import {
  checkRateLimit,
  recordPublish,
  type RateLimitStatus,
} from "./lib/rateLimit";
import { upsertReportIndexAfterReport } from "./lib/reportIndex";
import { ensureBlobsEnvironment } from "./lib/blobsEnvironment";

const REPORT_LIMITS = { hourly: 3, daily: 1000 };

const buildRateLimitHeaders = (status?: RateLimitStatus) => {
  if (!status) return {};
  return {
    "X-RateLimit-Limit": status.limit.toString(),
    "X-RateLimit-Remaining": status.remaining.toString(),
    "X-RateLimit-Reset": Math.floor(status.resetAt / 1000).toString(),
  };
};

const rateLimitResponse = (status: RateLimitStatus, message: string) => {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((status.resetAt - Date.now()) / 1000),
  );
  return {
    statusCode: 429,
    headers: {
      ...buildRateLimitHeaders(status),
      "Retry-After": retryAfterSeconds.toString(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ error: message }),
  };
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

const parseBody = (body: string | null): Record<string, unknown> | null => {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

export const handler: Handler = async (event) => {
  ensureBlobsEnvironment(event);
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  const slugParam = event.queryStringParameters?.slug;
  if (!slugParam) {
    return badRequest("Slug is required");
  }

  const slug = normalizeSlugInput(slugParam);
  if (!slug) {
    return badRequest("Invalid slug format");
  }

  const clientIp =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const limitStatus = await checkRateLimit(clientIp, REPORT_LIMITS, [
    "reports",
  ]);
  if (!limitStatus.allowed) {
    const retryMinutes = Math.ceil(
      Math.max(1, (limitStatus.resetAt - Date.now()) / 1000 / 60),
    );
    return rateLimitResponse(
      limitStatus,
      `Too many reports. Try again in ${retryMinutes} minute${
        retryMinutes === 1 ? "" : "s"
      }.`,
    );
  }

  const recordedStatus = await recordPublish(clientIp, REPORT_LIMITS, [
    "reports",
  ]);
  const headers = buildRateLimitHeaders(recordedStatus);

  const payload = parseBody(event.body);
  if (!payload) {
    return badRequest("Invalid JSON body", headers);
  }

  const reason =
    typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (!reason) {
    return badRequest("Reason is required", headers);
  }
  if (reason.length > 500) {
    return badRequest("Reason must be 500 characters or fewer", headers);
  }

  const timestamp = Date.now();
  await writeJsonBlob(["reports", slug, `${timestamp}.json`], {
    slug,
    reason,
    timestamp,
  });
  try {
    await upsertReportIndexAfterReport({ slug, reason, timestamp });
  } catch (error) {
    console.error("Failed to update report index", error);
  }

  return buildResponse(200, { reported: true }, headers);
};

import type { Handler } from "@netlify/functions";
import { storageClient } from "./lib/storage";
import { listDirectory, readJsonBlob } from "./lib/blobStorage";
import { checkAdminAuth } from "./lib/adminAuth";

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_DAY = 24 * MS_IN_HOUR;

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
const unauthorized = () => jsonResponse(401, { error: "Unauthorized" });

type LogEntry = {
  timestamp: number;
  type: string;
  outcome?: string;
};

const collectLogEntries = async (sinceMs: number) => {
  const directories = await listDirectory(["logs"]);
  const entries: LogEntry[] = [];
  for (const dir of directories) {
    const dirTimestamp = Date.parse(dir);
    if (Number.isNaN(dirTimestamp)) continue;
    if (dirTimestamp + MS_IN_DAY < sinceMs) {
      continue;
    }
    const files = await listDirectory(["logs", dir]);
    for (const file of files) {
      try {
        const entry = await readJsonBlob<LogEntry>(["logs", dir, file]);
        if (entry && entry.timestamp >= sinceMs) {
          entries.push(entry);
        }
      } catch {
        continue;
      }
    }
  }
  return entries;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed();
  }

  const auth = checkAdminAuth(event.headers);
  if (!auth.authorized) {
    return unauthorized();
  }

  const now = Date.now();
  const window30Days = now - 30 * MS_IN_DAY;
  const entries = await collectLogEntries(window30Days);
  const publishEntries = entries.filter(
    (entry) => entry.type === "publish" && entry.outcome === "success",
  );
  const rateLimitHits24h = entries.filter(
    (entry) =>
      entry.type === "publish" &&
      entry.outcome === "rate_limited" &&
      entry.timestamp >= now - MS_IN_DAY,
  ).length;
  const failedDeleteAttempts24h = entries.filter(
    (entry) =>
      entry.type === "delete" &&
      entry.outcome === "failed_password" &&
      entry.timestamp >= now - MS_IN_DAY,
  ).length;

  const publishesLast24Hours = publishEntries.filter(
    (entry) => entry.timestamp >= now - MS_IN_DAY,
  ).length;
  const publishesLast7Days = publishEntries.filter(
    (entry) => entry.timestamp >= now - 7 * MS_IN_DAY,
  ).length;
  const totalPublishesLast30Days = publishEntries.length;

  const metas = await storageClient.listMeta();
  const activeMetas = metas.filter(
    (meta) => meta.published && (!meta.expiresAt || meta.expiresAt > now),
  );
  const totalActive = activeMetas.length;
  const anonymousActive = activeMetas.filter((meta) => !meta.ownerHash).length;
  const protectedActive = totalActive - anonymousActive;

  return jsonResponse(200, {
    totalActive,
    anonymousActive,
    passwordProtectedActive: protectedActive,
    publishes: {
      last24Hours: publishesLast24Hours,
      last7Days: publishesLast7Days,
      last30Days: totalPublishesLast30Days,
    },
    rateLimitHitsLast24Hours: rateLimitHits24h,
    failedDeleteAttemptsLast24Hours: failedDeleteAttempts24h,
  });
};

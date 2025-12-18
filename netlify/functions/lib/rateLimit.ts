import crypto from "node:crypto";

import { deleteBlob, readJsonBlob, writeJsonBlob } from "./blobStorage";

const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

export const hashIp = (ip: string) =>
  crypto.createHash("sha256").update(ip).digest("hex");

type Bucket = {
  count: number;
  windowStart: number;
};

type RateLimitRecord = {
  hourly: Bucket;
  daily: Bucket;
};

type RateLimitStatus = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const buildRecordPath = (hash: string, namespace: string[]) => [
  "ratelimit",
  ...namespace,
  `${hash}.json`,
];

const normalizeBucket = (
  bucket: Bucket | undefined,
  windowMs: number,
  now: number,
): Bucket => {
  if (!bucket || now >= bucket.windowStart + windowMs) {
    return { count: 0, windowStart: now };
  }
  return bucket;
};

const normalizeRecord = (record: RateLimitRecord | null, now: number) => ({
  hourly: normalizeBucket(record?.hourly, HOURLY_WINDOW_MS, now),
  daily: normalizeBucket(record?.daily, DAILY_WINDOW_MS, now),
});

const deriveStatus = (
  record: RateLimitRecord,
  limits: { hourly: number; daily: number },
): RateLimitStatus => {
  const stats = [
    {
      name: "hourly",
      bucket: record.hourly,
      limit: limits.hourly,
      windowMs: HOURLY_WINDOW_MS,
    },
    {
      name: "daily",
      bucket: record.daily,
      limit: limits.daily,
      windowMs: DAILY_WINDOW_MS,
    },
  ].map((stat) => ({
    ...stat,
    remaining: Math.max(stat.limit - stat.bucket.count, 0),
    resetAt: stat.bucket.windowStart + stat.windowMs,
    overLimit: stat.bucket.count >= stat.limit,
  }));
  const blocking = stats.find((stat) => stat.overLimit);
  const best = stats.reduce((prev, curr) =>
    curr.remaining < prev.remaining ? curr : prev,
  );
  const selection = blocking ?? best;
  return {
    allowed: !Boolean(blocking),
    limit: selection.limit,
    remaining: selection.remaining,
    resetAt: selection.resetAt,
  };
};

const readRateRecord = async (hash: string, namespace: string[]) => {
  return readJsonBlob<RateLimitRecord>(buildRecordPath(hash, namespace));
};

export const checkRateLimit = async (
  ip: string | undefined,
  limits: { hourly: number; daily: number },
  namespace: string[] = ["ip"],
): Promise<RateLimitStatus> => {
  const now = Date.now();
  if (!ip) {
    return {
      allowed: true,
      limit: limits.daily,
      remaining: limits.daily,
      resetAt: now,
    };
  }
  const hash = hashIp(ip);
  const record = await readRateRecord(hash, namespace);
  const normalized = normalizeRecord(record, now);
  return deriveStatus(normalized, limits);
};

export const recordPublish = async (
  ip: string | undefined,
  limits: { hourly: number; daily: number },
  namespace: string[] = ["ip"],
): Promise<RateLimitStatus> => {
  const now = Date.now();
  if (!ip) {
    return {
      allowed: true,
      limit: limits.daily,
      remaining: limits.daily,
      resetAt: now,
    };
  }
  const hash = hashIp(ip);
  const record = normalizeRecord(await readRateRecord(hash, namespace), now);
  record.hourly.count += 1;
  record.daily.count += 1;
  await writeJsonBlob(buildRecordPath(hash, namespace), record);
  return deriveStatus(record, limits);
};

type AttemptRecord = {
  count: number;
  windowStart: number;
};

const buildAttemptPath = (slug: string) => ["attempts", `${slug}.json`];

const readAttemptRecord = async (slug: string) => {
  return readJsonBlob<AttemptRecord>(buildAttemptPath(slug));
};

export const checkAttemptLimit = async (slug: string) => {
  const now = Date.now();
  const record = await readAttemptRecord(slug);
  if (!record) {
    return { allowed: true, resetAt: now };
  }
  if (now >= record.windowStart + ATTEMPT_WINDOW_MS) {
    return { allowed: true, resetAt: now };
  }
  if (record.count >= 5) {
    return { allowed: false, resetAt: record.windowStart + ATTEMPT_WINDOW_MS };
  }
  return { allowed: true, resetAt: record.windowStart + ATTEMPT_WINDOW_MS };
};

export const recordFailedAttempt = async (slug: string) => {
  const now = Date.now();
  const record = await readAttemptRecord(slug);
  const shouldReset = !record || now >= record.windowStart + ATTEMPT_WINDOW_MS;
  const next: AttemptRecord = shouldReset
    ? { count: 1, windowStart: now }
    : { count: record.count + 1, windowStart: record.windowStart };
  await writeJsonBlob(buildAttemptPath(slug), next);
  return next;
};

export const clearAttempts = async (slug: string) => {
  await deleteBlob(buildAttemptPath(slug));
};

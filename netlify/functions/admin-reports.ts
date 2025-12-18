import type { Handler } from "@netlify/functions";
import {
  computeReportIndexFromReports,
  type ReportIndexEntry,
} from "./lib/reportIndex";
import { listDirectory, readJsonBlob, writeJsonBlob } from "./lib/blobStorage";
import { checkAdminAuth } from "./lib/adminAuth";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type Cursor = {
  lastReportedAt: string;
  slug: string;
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
const unauthorized = () => jsonResponse(401, { error: "Unauthorized" });
const badRequest = (message: string) => jsonResponse(400, { error: message });

const parseLimit = (value?: string | null) => {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return Math.min(parsed, MAX_LIMIT);
};

const parseBoolean = (value?: string | null) => {
  if (value === undefined || value === null) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
};

const parseIsoMs = (value: string | undefined | null) => {
  if (!value) return Number.NaN;
  return Date.parse(value);
};

const encodeCursor = (cursor: Cursor) =>
  Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64");

const decodeCursor = (value: string): Cursor | null => {
  try {
    const json = Buffer.from(value, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.lastReportedAt === "string" &&
      typeof parsed?.slug === "string"
    ) {
      return { lastReportedAt: parsed.lastReportedAt, slug: parsed.slug };
    }
    return null;
  } catch {
    return null;
  }
};

const shouldIncludeAfterCursor = (
  entry: ReportIndexEntry,
  cursor: Cursor,
): boolean => {
  const entryMs = parseIsoMs(entry.lastReportedAt);
  const cursorMs = parseIsoMs(cursor.lastReportedAt);
  if (Number.isNaN(cursorMs)) return true;
  if (Number.isNaN(entryMs)) return false;
  if (entryMs < cursorMs) return true;
  if (entryMs > cursorMs) return false;
  return entry.slug > cursor.slug;
};

const loadIndexEntries = async (): Promise<ReportIndexEntry[]> => {
  const files = await listDirectory(["reports-index"]);
  const entries: ReportIndexEntry[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const slug = file.replace(/\.json$/, "");
    const entry = await readJsonBlob<ReportIndexEntry>(["reports-index", file]);
    if (entry && entry.slug && entry.slug === slug) {
      entries.push(entry);
    }
  }
  return entries;
};

const backfillMissingIndexes = async (
  existingSlugs: Set<string>,
): Promise<ReportIndexEntry[]> => {
  const reportDirs = await listDirectory(["reports"]);
  const created: ReportIndexEntry[] = [];

  for (const dir of reportDirs) {
    if (existingSlugs.has(dir)) continue;
    const computed = await computeReportIndexFromReports(dir);
    if (!computed) continue;
    await writeJsonBlob(["reports-index", `${dir}.json`], computed);
    created.push(computed);
  }

  return created;
};

const sortEntries = (entries: ReportIndexEntry[]) => {
  return [...entries].sort((a, b) => {
    const aMs = parseIsoMs(a.lastReportedAt);
    const bMs = parseIsoMs(b.lastReportedAt);
    if (!Number.isNaN(aMs) && !Number.isNaN(bMs) && aMs !== bMs) {
      return bMs - aMs;
    }
    if (Number.isNaN(aMs) && !Number.isNaN(bMs)) return 1;
    if (!Number.isNaN(aMs) && Number.isNaN(bMs)) return -1;
    return a.slug.localeCompare(b.slug);
  });
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed();
  }

  const auth = checkAdminAuth(event.headers);
  if (!auth.authorized) {
    console.warn("Admin auth failed", {
      provided: auth.providedLabel,
      envPresent: auth.hasConfiguredSecret,
    });
    return unauthorized();
  }

  const limit = parseLimit(event.queryStringParameters?.limit);
  if (limit === null) {
    return badRequest("Invalid limit");
  }

  const reviewedFilter = parseBoolean(event.queryStringParameters?.reviewed);
  if (reviewedFilter === null) {
    return badRequest("Invalid reviewed value");
  }

  const sinceParam = event.queryStringParameters?.since;
  let sinceMs: number | null = null;
  if (sinceParam) {
    const parsed = Date.parse(sinceParam);
    if (Number.isNaN(parsed)) {
      return badRequest("Invalid since value");
    }
    sinceMs = parsed;
  }

  const cursorParam = event.queryStringParameters?.cursor;
  const cursor = cursorParam ? decodeCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    return badRequest("Invalid cursor");
  }

  const indexEntries = await loadIndexEntries();
  const indexSlugs = new Set(indexEntries.map((entry) => entry.slug));
  const regenerated = await backfillMissingIndexes(indexSlugs);
  const allEntries = [...indexEntries, ...regenerated];

  const filtered = allEntries.filter((entry) => {
    const entryMs = parseIsoMs(entry.lastReportedAt);
    if (sinceMs !== null) {
      if (Number.isNaN(entryMs) || entryMs <= sinceMs) return false;
    }
    if (typeof reviewedFilter === "boolean") {
      if (entry.reviewed !== reviewedFilter) return false;
    }
    return true;
  });

  const sorted = sortEntries(filtered);
  const total = sorted.length;

  const paged = cursor
    ? sorted.filter((entry) => shouldIncludeAfterCursor(entry, cursor))
    : sorted;
  const items = paged.slice(0, limit);
  const hasNext = paged.length > limit;
  const nextCursor =
    hasNext && items.length > 0
      ? encodeCursor({
          lastReportedAt: items[items.length - 1].lastReportedAt,
          slug: items[items.length - 1].slug,
        })
      : null;

  const responseItems = items.map((item) => ({
    slug: item.slug,
    reportCount: item.reportCount,
    lastReportedAt: item.lastReportedAt,
    lastReason: item.lastReason,
    reviewed: item.reviewed,
  }));

  return jsonResponse(200, {
    items: responseItems,
    nextCursor,
    total,
  });
};

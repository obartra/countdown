import type { Handler } from "@netlify/functions";
import { storageClient, type PublicationMeta } from "./lib/storage";
import { checkAdminAuth } from "./lib/adminAuth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type Cursor = {
  createdAt: number;
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
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return Math.min(parsed, MAX_LIMIT);
};

const encodeCursor = (cursor: Cursor) =>
  Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64");

const decodeCursor = (value: string): Cursor | null => {
  try {
    const json = Buffer.from(value, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.createdAt === "number" &&
      typeof parsed?.slug === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const shouldIncludeAfterCursor = (meta: PublicationMeta, cursor: Cursor) => {
  if (meta.createdAt < cursor.createdAt) return true;
  if (meta.createdAt > cursor.createdAt) return false;
  return meta.slug > cursor.slug;
};

const sortMetas = (entries: PublicationMeta[]) => {
  return [...entries].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return b.createdAt - a.createdAt;
    }
    return a.slug.localeCompare(b.slug);
  });
};

const normalizeMetaForResponse = (meta: PublicationMeta) => ({
  slug: meta.slug,
  createdAt: meta.createdAt,
  timeMs: meta.timeMs,
  expiresAt: meta.expiresAt ?? null,
  published: Boolean(meta.published),
  requiresPassword: Boolean(meta.ownerHash),
});

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

  const cursorParam = event.queryStringParameters?.cursor;
  const cursor = cursorParam ? decodeCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    return badRequest("Invalid cursor");
  }

  const metas = await storageClient.listMeta();
  const now = Date.now();
  const publishedEntries = metas.filter(
    (meta) => meta.published && (!meta.expiresAt || meta.expiresAt > now),
  );
  const sorted = sortMetas(publishedEntries);
  const total = sorted.length;

  const paged = cursor
    ? sorted.filter((entry) => shouldIncludeAfterCursor(entry, cursor))
    : sorted;
  const items = paged.slice(0, limit);
  const hasNext = paged.length > limit;
  const nextCursor =
    hasNext && items.length > 0
      ? encodeCursor({
          createdAt: items[items.length - 1].createdAt,
          slug: items[items.length - 1].slug,
        })
      : null;

  return jsonResponse(200, {
    items: items.map(normalizeMetaForResponse),
    nextCursor,
    total,
  });
};

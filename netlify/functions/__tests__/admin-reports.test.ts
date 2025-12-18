import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const ADMIN_SECRET = "super-secret";

const createEvent = (query: Record<string, string | undefined> = {}) => ({
  version: "1.0",
  rawPath: "/admin/reports",
  rawQuery: "",
  path: "/admin/reports",
  httpMethod: "GET",
  headers: {
    host: "localhost:8080",
    "x-forwarded-proto": "https",
    "x-admin-secret": ADMIN_SECRET,
  },
  multiValueHeaders: {},
  queryStringParameters: query,
  multiValueQueryStringParameters: {},
  requestContext: {} as any,
  body: null,
  isBase64Encoded: false,
  cookies: [],
});

const createPatchEvent = (slug: string) => ({
  version: "1.0",
  rawPath: `/admin/reports/${slug}`,
  rawQuery: "",
  path: `/admin/reports/${slug}`,
  httpMethod: "PATCH",
  headers: {
    host: "localhost:8080",
    "x-forwarded-proto": "https",
    "x-admin-secret": ADMIN_SECRET,
  },
  multiValueHeaders: {},
  queryStringParameters: { slug },
  multiValueQueryStringParameters: {},
  requestContext: {} as any,
  body: null,
  isBase64Encoded: false,
  cookies: [],
});

const createDeleteEvent = (
  slug: string,
  query: Record<string, string> = {},
) => ({
  version: "1.0",
  rawPath: `/admin/reports/${slug}`,
  rawQuery: "",
  path: `/admin/reports/${slug}`,
  httpMethod: "DELETE",
  headers: {
    host: "localhost:8080",
    "x-forwarded-proto": "https",
    "x-admin-secret": ADMIN_SECRET,
  },
  multiValueHeaders: {},
  queryStringParameters: { slug, ...query },
  multiValueQueryStringParameters: {},
  requestContext: {} as any,
  body: null,
  isBase64Encoded: false,
  cookies: [],
});

const writeIndex = async (
  storageDir: string,
  slug: string,
  data: Record<string, unknown>,
) => {
  const indexPath = path.join(storageDir, "reports-index");
  await fs.mkdir(indexPath, { recursive: true });
  await fs.writeFile(
    path.join(indexPath, `${slug}.json`),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
};

const writeReportBlob = async (
  storageDir: string,
  slug: string,
  timestamp: number,
) => {
  const reportsDir = path.join(storageDir, "reports", slug);
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(
    path.join(reportsDir, `${timestamp}.json`),
    JSON.stringify({ slug, reason: "flag", timestamp }),
    "utf-8",
  );
};

describe("admin reports endpoint", () => {
  let storageDir: string;
  let handler: typeof import("../admin-reports").handler;
  let patchHandler: typeof import("../admin-reports-slug").handler;

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "countdown-admin-reports-"),
    );
    process.env.COUNTDOWN_STORAGE_DIR = storageDir;
    process.env.ADMIN_SECRET = ADMIN_SECRET;
    ({ handler } = await import("../admin-reports"));
    ({ handler: patchHandler } = await import("../admin-reports-slug"));
  });

  afterEach(async () => {
    delete process.env.COUNTDOWN_STORAGE_DIR;
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET_LOCAL;
    delete process.env.ADMIN_SECRET_DEV;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it("rejects requests without a valid secret", async () => {
    const response = await handler({
      ...createEvent(),
      headers: { host: "localhost:8080" },
    });
    expect(response.statusCode).toBe(401);

    const responseWrongSecret = await handler({
      ...createEvent(),
      headers: { ...createEvent().headers, "x-admin-secret": "wrong" },
    });
    expect(responseWrongSecret.statusCode).toBe(401);
  });

  it("accepts ADMIN_SECRET_LOCAL when primary secret is absent", async () => {
    delete process.env.ADMIN_SECRET;
    process.env.ADMIN_SECRET_LOCAL = ADMIN_SECRET;
    vi.resetModules();
    ({ handler } = await import("../admin-reports"));

    const response = await handler(createEvent());
    expect(response.statusCode).toBe(200);
  });

  it("returns empty state", async () => {
    const response = await handler(createEvent());
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
    expect(body.total).toBe(0);
  });

  it("paginates results ordered by lastReportedAt desc", async () => {
    await writeIndex(storageDir, "second", {
      slug: "second",
      reportCount: 1,
      firstReportedAt: new Date(1000).toISOString(),
      lastReportedAt: new Date(1000).toISOString(),
      lastReason: "older",
      reviewed: false,
    });
    await writeIndex(storageDir, "first", {
      slug: "first",
      reportCount: 2,
      firstReportedAt: new Date(2000).toISOString(),
      lastReportedAt: new Date(2000).toISOString(),
      lastReason: "newer",
      reviewed: false,
    });

    const firstPage = await handler(createEvent({ limit: "1" }));
    expect(firstPage.statusCode).toBe(200);
    const body1 = JSON.parse(firstPage.body);
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0].slug).toBe("first");
    expect(body1.total).toBe(2);
    expect(body1.nextCursor).toBeTruthy();

    const secondPage = await handler(
      createEvent({ cursor: body1.nextCursor as string }),
    );
    expect(secondPage.statusCode).toBe(200);
    const body2 = JSON.parse(secondPage.body);
    expect(body2.items).toHaveLength(1);
    expect(body2.items[0].slug).toBe("second");
    expect(body2.nextCursor).toBeNull();
  });

  it("filters by since and reviewed", async () => {
    await writeIndex(storageDir, "old-reviewed", {
      slug: "old-reviewed",
      reportCount: 1,
      firstReportedAt: new Date(1000).toISOString(),
      lastReportedAt: new Date(1000).toISOString(),
      lastReason: "old",
      reviewed: true,
    });
    await writeIndex(storageDir, "new-unreviewed", {
      slug: "new-unreviewed",
      reportCount: 3,
      firstReportedAt: new Date(3000).toISOString(),
      lastReportedAt: new Date(3000).toISOString(),
      lastReason: "new",
      reviewed: false,
    });

    const sinceDate = new Date(2000).toISOString();
    const response = await handler(
      createEvent({ since: sinceDate, reviewed: "false" }),
    );
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].slug).toBe("new-unreviewed");
    expect(body.total).toBe(1);
  });

  it("regenerates missing index entries from reports", async () => {
    const reportsDir = path.join(storageDir, "reports", "missing-index");
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(
      path.join(reportsDir, "1000.json"),
      JSON.stringify({
        slug: "missing-index",
        reason: "flag",
        timestamp: 1000,
      }),
      "utf-8",
    );

    const response = await handler(createEvent());
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.some((item: any) => item.slug === "missing-index")).toBe(
      true,
    );

    const indexPath = path.join(
      storageDir,
      "reports-index",
      "missing-index.json",
    );
    const exists = await fs.readFile(indexPath, "utf-8");
    expect(JSON.parse(exists).slug).toBe("missing-index");
  });

  it("marks a report index entry as reviewed", async () => {
    await writeIndex(storageDir, "mark-me", {
      slug: "mark-me",
      reportCount: 2,
      firstReportedAt: new Date(1000).toISOString(),
      lastReportedAt: new Date(2000).toISOString(),
      lastReason: "reason",
      reviewed: false,
    });

    const response = await patchHandler(createPatchEvent("mark-me"));
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.reviewed).toBe(true);

    const indexPath = path.join(storageDir, "reports-index", "mark-me.json");
    const data = JSON.parse(await fs.readFile(indexPath, "utf-8"));
    expect(data.reviewed).toBe(true);
  });

  it("clears report metadata without purging blobs", async () => {
    await writeIndex(storageDir, "clear-me", {
      slug: "clear-me",
      reportCount: 3,
      firstReportedAt: new Date(1000).toISOString(),
      lastReportedAt: new Date(2000).toISOString(),
      lastReason: "bad",
      reviewed: false,
    });
    await writeReportBlob(storageDir, "clear-me", 1000);

    const response = await patchHandler(createDeleteEvent("clear-me"));
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.cleared).toBe(true);
    expect(payload.purged).toBe(false);

    const indexPath = path.join(storageDir, "reports-index", "clear-me.json");
    const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
    expect(index.reportCount).toBe(0);
    expect(index.lastReason).toBe("");
    expect(index.reviewed).toBe(true);

    const files = await fs.readdir(
      path.join(storageDir, "reports", "clear-me"),
    );
    expect(files.length).toBeGreaterThan(0);

    const logDate = new Date().toISOString().slice(0, 10);
    const logPath = path.join(
      storageDir,
      "logs",
      logDate,
      "admin-actions.json",
    );
    const logEntries = JSON.parse(await fs.readFile(logPath, "utf-8"));
    expect(logEntries.some((entry: any) => entry.slug === "clear-me")).toBe(
      true,
    );
  });

  it("clears and purges report blobs when requested", async () => {
    await writeIndex(storageDir, "purge-me", {
      slug: "purge-me",
      reportCount: 1,
      firstReportedAt: new Date(500).toISOString(),
      lastReportedAt: new Date(500).toISOString(),
      lastReason: "reason",
      reviewed: false,
    });
    await writeReportBlob(storageDir, "purge-me", 500);

    const response = await patchHandler(
      createDeleteEvent("purge-me", { purgeBlobs: "true" }),
    );
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.purged).toBe(true);

    const reportsDir = path.join(storageDir, "reports", "purge-me");
    const files = await fs.readdir(reportsDir).catch(() => []);
    expect(files.length).toBe(0);
  });
});

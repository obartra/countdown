import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const ADMIN_SECRET = "super-secret";

const createEvent = (query: Record<string, string | undefined> = {}) => ({
  version: "1.0",
  rawPath: "/api/admin/published",
  rawQuery: "",
  path: "/api/admin/published",
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

const writeMeta = async (
  storageDir: string,
  slug: string,
  data: Record<string, unknown>,
) => {
  const metaDir = path.join(storageDir, "meta");
  await fs.mkdir(metaDir, { recursive: true });
  await fs.writeFile(
    path.join(metaDir, `${slug}.json`),
    JSON.stringify({ slug, ...data }, null, 2),
    "utf-8",
  );
};

describe("admin published endpoint", () => {
  let storageDir: string;
  let handler: typeof import("../admin-published").handler;

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "countdown-admin-published-"),
    );
    process.env.COUNTDOWN_STORAGE_DIR = storageDir;
    process.env.ADMIN_SECRET = ADMIN_SECRET;
    ({ handler } = await import("../admin-published"));
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

  it("returns empty state when no published data exists", async () => {
    const response = await handler(createEvent());
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
    expect(body.total).toBe(0);
  });

  it("lists published slugs sorted by creation time", async () => {
    await writeMeta(storageDir, "old", {
      createdAt: 1_000,
      timeMs: 2_000,
      expiresAt: null,
      published: true,
    });
    await writeMeta(storageDir, "new", {
      createdAt: 2_000,
      timeMs: 2_500,
      expiresAt: null,
      published: true,
    });

    const firstPage = await handler(createEvent({ limit: "1" }));
    expect(firstPage.statusCode).toBe(200);
    const body1 = JSON.parse(firstPage.body);
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0].slug).toBe("new");
    expect(body1.items[0].requiresPassword).toBe(false);
    expect(body1.total).toBe(2);
    expect(body1.nextCursor).toBeTruthy();

    const secondPage = await handler(
      createEvent({ cursor: body1.nextCursor as string }),
    );
    expect(secondPage.statusCode).toBe(200);
    const body2 = JSON.parse(secondPage.body);
    expect(body2.items).toHaveLength(1);
    expect(body2.items[0].slug).toBe("old");
    expect(body2.nextCursor).toBeNull();
  });

  it("filters out expired slugs", async () => {
    const now = Date.now();
    await writeMeta(storageDir, "expired", {
      createdAt: now - 10_000,
      timeMs: 0,
      expiresAt: now - 1,
      published: true,
    });
    await writeMeta(storageDir, "active", {
      createdAt: now,
      timeMs: 0,
      expiresAt: now + 1_000_000,
      published: true,
      ownerHash: "abc",
    });

    const response = await handler(createEvent());
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].slug).toBe("active");
    expect(body.total).toBe(1);
  });

  it("rejects an invalid cursor value", async () => {
    const response = await handler(createEvent({ cursor: "invalid" }));
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Invalid cursor");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

describe("admin stats endpoint", () => {
  let storageDir: string;
  let adminStatsModule: typeof import("../admin-stats");
  let storageModule: typeof import("../storage");
  let loggerModule: typeof import("../logger");

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "countdown-admin-"));
    process.env.COUNTDOWN_STORAGE_DIR = storageDir;
    process.env.ADMIN_SECRET = "test-secret";
    storageModule = await import("../lib/storage");
    loggerModule = await import("../lib/logger");
    adminStatsModule = await import("../admin-stats");
  });

  afterEach(async () => {
    delete process.env.COUNTDOWN_STORAGE_DIR;
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET_LOCAL;
    delete process.env.ADMIN_SECRET_DEV;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it("returns 401 when secret is missing or wrong", async () => {
    const response = await adminStatsModule.handler({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {},
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      rawPath: "/admin-stats",
      rawQuery: "",
      path: "/admin-stats",
      requestContext: {} as any,
      body: null,
      isBase64Encoded: false,
      cookies: [],
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns aggregated stats when authorized", async () => {
    const now = Date.now();
    await storageModule.storageClient.writeMeta("anon-slug", {
      slug: "anon-slug",
      createdAt: now,
      timeMs: now + 1000,
      expiresAt: now + 1000,
      published: true,
    });
    await storageModule.storageClient.writeMeta("custom-slug", {
      slug: "custom-slug",
      createdAt: now,
      timeMs: now + 1000,
      expiresAt: now + 1000,
      published: true,
      ownerHash: "hash",
    });

    await loggerModule.logPublish({
      slug: "anon-slug",
      slugType: "anonymous",
      outcome: "success",
    });
    await loggerModule.logPublish({
      slug: "anon-slug",
      slugType: "anonymous",
      outcome: "rate_limited",
    });
    await loggerModule.logDelete({
      slug: "custom-slug",
      outcome: "failed_password",
    });

    const response = await adminStatsModule.handler({
      httpMethod: "GET",
      headers: { "x-admin-secret": "test-secret" },
      queryStringParameters: {},
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      rawPath: "/admin-stats",
      rawQuery: "",
      path: "/admin-stats",
      requestContext: {} as any,
      body: null,
      isBase64Encoded: false,
      cookies: [],
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.totalActive).toBe(2);
    expect(payload.anonymousActive).toBe(1);
    expect(payload.passwordProtectedActive).toBe(1);
    expect(payload.publishes.last24Hours).toBe(1);
    expect(payload.publishes.last7Days).toBe(1);
    expect(payload.publishes.last30Days).toBe(1);
    expect(payload.rateLimitHitsLast24Hours).toBe(1);
    expect(payload.failedDeleteAttemptsLast24Hours).toBe(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

describe("report endpoint", () => {
  let storageDir: string;
  let reportModule: typeof import("../report");

  const createEvent = (slug: string, body: object, ip?: string) => ({
    version: "1.0",
    rawPath: `/v/${slug}/report`,
    rawQuery: "",
    path: `/v/${slug}/report`,
    httpMethod: "POST",
    headers: {
      host: "localhost:8080",
      "x-forwarded-proto": "https",
      ...(ip ? { "x-nf-client-connection-ip": ip } : {}),
    },
    multiValueHeaders: {},
    queryStringParameters: { slug },
    multiValueQueryStringParameters: {},
    requestContext: {} as any,
    body: JSON.stringify(body),
    isBase64Encoded: false,
    cookies: [],
  });

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "countdown-report-"));
    process.env.COUNTDOWN_STORAGE_DIR = storageDir;
    reportModule = await import("../report");
  });

  afterEach(async () => {
    delete process.env.COUNTDOWN_STORAGE_DIR;
    await fs.rm(storageDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it("stores a report payload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

    const response = await reportModule.handler(
      createEvent("valid-slug", { reason: "inappropriate" }, "1.2.3.4"),
    );
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.reported).toBe(true);

    const reportsDir = path.join(storageDir, "reports", "valid-slug");
    const files = await fs.readdir(reportsDir);
    expect(files.length).toBeGreaterThan(0);

    const entry = JSON.parse(
      await fs.readFile(path.join(reportsDir, files[0]), "utf-8"),
    );
    expect(entry.reason).toBe("inappropriate");
    expect(entry.slug).toBe("valid-slug");

    const indexPath = path.join(storageDir, "reports-index", "valid-slug.json");
    const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
    expect(index.slug).toBe("valid-slug");
    expect(index.reportCount).toBe(1);
    expect(index.firstReportedAt).toBe(new Date(Date.now()).toISOString());
    expect(index.lastReportedAt).toBe(new Date(Date.now()).toISOString());
    expect(index.lastReason).toBe("inappropriate");
    expect(index.reviewed).toBe(false);
  });

  it("updates the report index on subsequent reports", async () => {
    vi.useFakeTimers();

    const t1 = new Date("2025-01-01T00:00:00Z").getTime();
    const t2 = new Date("2025-01-01T00:10:00Z").getTime();

    vi.setSystemTime(t1);
    await reportModule.handler(
      createEvent("index-slug", { reason: "first" }, "1.2.3.4"),
    );

    vi.setSystemTime(t2);
    await reportModule.handler(
      createEvent("index-slug", { reason: "second" }, "1.2.3.4"),
    );

    const indexPath = path.join(storageDir, "reports-index", "index-slug.json");
    const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
    expect(index.reportCount).toBe(2);
    expect(index.firstReportedAt).toBe(new Date(t1).toISOString());
    expect(index.lastReportedAt).toBe(new Date(t2).toISOString());
    expect(index.lastReason).toBe("second");
    expect(index.reviewed).toBe(false);
  });

  it("rate limits after three reports per hour", async () => {
    const ip = "203.0.113.100";
    for (let i = 0; i < 3; i += 1) {
      const response = await reportModule.handler(
        createEvent("slug-limit", { reason: "spam" }, ip),
      );
      expect(response.statusCode).toBe(200);
    }

    const blocked = await reportModule.handler(
      createEvent("slug-limit", { reason: "spam" }, ip),
    );
    expect(blocked.statusCode).toBe(429);
    const payload = JSON.parse(blocked.body);
    expect(payload.error).toContain("Too many reports");
    expect(blocked.headers["Retry-After"]).toBeDefined();
  });
});

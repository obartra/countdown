import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

describe("rate limit helpers", () => {
  let storageDir: string;
  let rateLimit: typeof import("./rateLimit");

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "countdown-rate-"));
    process.env.COUNTDOWN_STORAGE_DIR = storageDir;
    rateLimit = await import("./rateLimit");
  });

  afterEach(async () => {
    delete process.env.COUNTDOWN_STORAGE_DIR;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it("blocks after hitting the hourly publish limit", async () => {
    const ip = "203.0.113.1";
    const limits = { hourly: 2, daily: 100 };
    await rateLimit.recordPublish(ip, limits);
    await rateLimit.recordPublish(ip, limits);
    const status = await rateLimit.checkRateLimit(ip, limits);
    expect(status.allowed).toBe(false);
    expect(status.remaining).toBe(0);
  });

  it("allows publish when under the limit", async () => {
    const ip = "203.0.113.2";
    const limits = { hourly: 5, daily: 100 };
    const status = await rateLimit.recordPublish(ip, limits);
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(4);
  });

  it("tracks delete attempt limits and clears on success", async () => {
    const slug = "test-slug";
    for (let i = 0; i < 5; i += 1) {
      await rateLimit.recordFailedAttempt(slug);
    }
    const locked = await rateLimit.checkAttemptLimit(slug);
    expect(locked.allowed).toBe(false);
    await rateLimit.clearAttempts(slug);
    const reset = await rateLimit.checkAttemptLimit(slug);
    expect(reset.allowed).toBe(true);
  });
});

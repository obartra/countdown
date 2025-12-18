import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

describe("logger helpers", () => {
  let logger: typeof import("./logger");
  let storageDir: string;

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "countdown-logs-"));
    process.env.COUNTDOWN_STORAGE_DIR = storageDir;
    logger = await import("./logger");
  });

  afterEach(async () => {
    delete process.env.COUNTDOWN_STORAGE_DIR;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  const getLogEntryFiles = async () => {
    const dateDir = new Date(Date.now()).toISOString().slice(0, 10);
    const logsPath = path.join(storageDir, "logs", dateDir);
    const files = await fs.readdir(logsPath);
    return files.map((file) => path.join(logsPath, file));
  };

  it("writes publish logs", async () => {
    await logger.logPublish({
      slug: "test",
      slugType: "custom",
      outcome: "success",
    });
    const files = await getLogEntryFiles();
    expect(files.length).toBe(1);
    const entry = JSON.parse(await fs.readFile(files[0], "utf-8"));
    expect(entry.type).toBe("publish");
    expect(entry.slug).toBe("test");
    expect(entry.outcome).toBe("success");
  });

  it("writes delete logs", async () => {
    await logger.logDelete({
      slug: "delete-me",
      outcome: "failed_password",
    });
    const files = await getLogEntryFiles();
    expect(files.length).toBe(1);
    const entry = JSON.parse(await fs.readFile(files[0], "utf-8"));
    expect(entry.type).toBe("delete");
    expect(entry.slug).toBe("delete-me");
    expect(entry.outcome).toBe("failed_password");
  });

  it("writes cleanup logs", async () => {
    await logger.logCleanup({ removed: 2, scanned: 5 });
    const files = await getLogEntryFiles();
    expect(files.length).toBe(1);
    const entry = JSON.parse(await fs.readFile(files[0], "utf-8"));
    expect(entry.type).toBe("cleanup");
    expect(entry.removed).toBe(2);
    expect(entry.scanned).toBe(5);
  });

  it("appends admin action logs", async () => {
    await logger.logAdminAction({
      action: "delete",
      slug: "demo",
      actor: "admin_override",
    });
    await logger.logAdminAction({
      action: "clear",
      slug: "demo",
      actor: "admin",
    });
    const files = await getLogEntryFiles();
    const adminFile = files.find((file) => file.includes("admin-actions"));
    expect(adminFile).toBeDefined();
    const entries = JSON.parse(await fs.readFile(adminFile!, "utf-8"));
    expect(Array.isArray(entries)).toBe(true);
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("delete");
    expect(entries[1].action).toBe("clear");
  });
});

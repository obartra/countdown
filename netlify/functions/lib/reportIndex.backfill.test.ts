import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runBackfillScript = (storageDir: string) => {
  const scriptPath = path.resolve(
    process.cwd(),
    "scripts",
    "backfill-report-index.ts",
  );
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", scriptPath],
    {
      env: {
        ...process.env,
        COUNTDOWN_STORAGE_DIR: storageDir,
      },
      encoding: "utf-8",
    },
  );
};

describe("backfill-report-index script", () => {
  let storageDir: string;

  beforeEach(async () => {
    vi.resetModules();
    storageDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "countdown-backfill-"),
    );
  });

  afterEach(async () => {
    await fs.rm(storageDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it("creates missing report index entries", async () => {
    const reportsDir = path.join(storageDir, "reports", "slug-a");
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(
      path.join(reportsDir, "1000.json"),
      JSON.stringify({ slug: "slug-a", reason: "first", timestamp: 1000 }),
      "utf-8",
    );
    await fs.writeFile(
      path.join(reportsDir, "2000.json"),
      JSON.stringify({ slug: "slug-a", reason: "second", timestamp: 2000 }),
      "utf-8",
    );

    const result = runBackfillScript(storageDir);
    expect(result.status).toBe(0);

    const indexPath = path.join(storageDir, "reports-index", "slug-a.json");
    const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
    expect(index.slug).toBe("slug-a");
    expect(index.reportCount).toBe(2);
    expect(index.firstReportedAt).toBe(new Date(1000).toISOString());
    expect(index.lastReportedAt).toBe(new Date(2000).toISOString());
    expect(index.lastReason).toBe("second");
    expect(index.reviewed).toBe(false);
  });

  it("does not overwrite an existing index entry", async () => {
    const reportsDir = path.join(storageDir, "reports", "slug-b");
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(
      path.join(reportsDir, "1234.json"),
      JSON.stringify({ slug: "slug-b", reason: "report", timestamp: 1234 }),
      "utf-8",
    );

    const existingIndexPath = path.join(
      storageDir,
      "reports-index",
      "slug-b.json",
    );
    await fs.mkdir(path.dirname(existingIndexPath), { recursive: true });
    await fs.writeFile(
      existingIndexPath,
      JSON.stringify(
        {
          slug: "slug-b",
          reportCount: 99,
          firstReportedAt: new Date(1).toISOString(),
          lastReportedAt: new Date(2).toISOString(),
          lastReason: "keep",
          reviewed: true,
        },
        null,
        2,
      ),
      "utf-8",
    );

    const result = runBackfillScript(storageDir);
    expect(result.status).toBe(0);

    const index = JSON.parse(await fs.readFile(existingIndexPath, "utf-8"));
    expect(index.reportCount).toBe(99);
    expect(index.reviewed).toBe(true);
    expect(index.lastReason).toBe("keep");
  });
});

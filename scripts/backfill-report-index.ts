#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

type ReportDetail = { slug?: string; reason?: string; timestamp?: number };
type ReportIndexEntry = {
  slug: string;
  reportCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  lastReason: string;
  reviewed: boolean;
};

const storageRoot =
  process.env.COUNTDOWN_STORAGE_DIR ||
  path.resolve(process.cwd(), ".netlify", "published-data");

const resolvePath = (...segments: string[]) =>
  path.join(storageRoot, ...segments);

const readDirSafe = async (...segments: string[]) => {
  try {
    const dir = resolvePath(...segments);
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ((error as { code?: string }).code === "ENOENT" ||
        (error as { code?: string }).code === "ENOTDIR")
    ) {
      return [];
    }
    throw error;
  }
};

const readJson = async <T>(...segments: string[]): Promise<T | null> => {
  try {
    const file = await fs.readFile(resolvePath(...segments), "utf-8");
    return JSON.parse(file) as T;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
};

const writeJson = async (data: unknown, ...segments: string[]) => {
  const filePath = resolvePath(...segments);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const toIso = (ms: number) => new Date(ms).toISOString();

const computeIndexForSlug = async (
  slug: string,
): Promise<ReportIndexEntry | null> => {
  const entries = await readDirSafe("reports", slug);
  const records: Array<{ reason: string; timestamp: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const detail = await readJson<ReportDetail>("reports", slug, entry.name);
    const reason =
      typeof detail?.reason === "string" ? detail.reason.trim() : "";
    const timestamp =
      typeof detail?.timestamp === "number" ? detail.timestamp : null;
    if (!reason || timestamp === null) continue;
    records.push({ reason, timestamp });
  }
  if (records.length === 0) return null;

  let first = records[0];
  let last = records[0];
  for (const record of records) {
    if (record.timestamp < first.timestamp) first = record;
    if (record.timestamp > last.timestamp) last = record;
  }

  return {
    slug,
    reportCount: records.length,
    firstReportedAt: toIso(first.timestamp),
    lastReportedAt: toIso(last.timestamp),
    lastReason: last.reason,
    reviewed: false,
  };
};

const main = async () => {
  const reportDirs = await readDirSafe("reports");
  let scannedSlugs = 0;
  let created = 0;
  let skippedExisting = 0;
  let skippedEmpty = 0;

  for (const entry of reportDirs) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    scannedSlugs += 1;
    const existing = await readJson<ReportIndexEntry>(
      "reports-index",
      `${slug}.json`,
    );
    if (existing) {
      skippedExisting += 1;
      continue;
    }

    const index = await computeIndexForSlug(slug);
    if (!index) {
      skippedEmpty += 1;
      continue;
    }

    await writeJson(index, "reports-index", `${slug}.json`);
    created += 1;
  }

  const message = [
    "Report index backfill complete.",
    `Scanned: ${scannedSlugs}`,
    `Created: ${created}`,
    `Skipped (existing): ${skippedExisting}`,
    `Skipped (empty): ${skippedEmpty}`,
  ].join(" ");
  console.log(message);
};

main().catch((error) => {
  console.error("Report index backfill failed:", error);
  process.exit(1);
});

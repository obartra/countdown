import { listDirectory, readJsonBlob, writeJsonBlob } from "./blobStorage";

export type ReportIndexEntry = {
  slug: string;
  reportCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  lastReason: string;
  reviewed: boolean;
};

type ReportDetailBlob = {
  slug?: string;
  reason?: string;
  timestamp?: number;
};

const indexPath = (slug: string) => ["reports-index", `${slug}.json`];

const toIso = (timestamp: number) => new Date(timestamp).toISOString();

const safeParseIso = (value: string) => {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

export const readReportIndex = async (slug: string) => {
  return readJsonBlob<ReportIndexEntry>(indexPath(slug));
};

export const upsertReportIndexAfterReport = async (args: {
  slug: string;
  reason: string;
  timestamp: number;
}) => {
  const { slug, reason, timestamp } = args;
  const nowIso = toIso(timestamp);
  const existing = await readReportIndex(slug);

  if (!existing) {
    const created: ReportIndexEntry = {
      slug,
      reportCount: 1,
      firstReportedAt: nowIso,
      lastReportedAt: nowIso,
      lastReason: reason,
      reviewed: false,
    };
    await writeJsonBlob(indexPath(slug), created);
    return created;
  }

  const firstMs = safeParseIso(existing.firstReportedAt);
  const lastMs = safeParseIso(existing.lastReportedAt);

  const nextFirstIso =
    firstMs === null ? nowIso : toIso(Math.min(firstMs, timestamp));
  const shouldUpdateLast = lastMs === null || timestamp >= lastMs;
  const nextLastIso = shouldUpdateLast
    ? nowIso
    : existing.lastReportedAt || nowIso;

  const updated: ReportIndexEntry = {
    ...existing,
    slug,
    reportCount: Math.max(0, (existing.reportCount ?? 0) + 1),
    firstReportedAt: nextFirstIso,
    lastReportedAt: nextLastIso,
    lastReason: shouldUpdateLast ? reason : existing.lastReason,
    reviewed: false,
  };

  await writeJsonBlob(indexPath(slug), updated);
  return updated;
};

const readReportsForSlug = async (slug: string) => {
  const files = await listDirectory(["reports", slug]);
  const records: Array<{ reason: string; timestamp: number }> = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const detail = await readJsonBlob<ReportDetailBlob>([
      "reports",
      slug,
      file,
    ]);
    const reason =
      typeof detail?.reason === "string" ? detail.reason.trim() : "";
    const timestamp =
      typeof detail?.timestamp === "number" ? detail.timestamp : null;
    if (!reason || timestamp === null) continue;
    records.push({ reason, timestamp });
  }

  return records;
};

export const computeReportIndexFromReports = async (
  slug: string,
): Promise<ReportIndexEntry | null> => {
  const records = await readReportsForSlug(slug);
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

export type BackfillReportIndexResult = {
  scannedSlugs: number;
  created: number;
  skippedExisting: number;
  skippedEmpty: number;
};

export const backfillReportIndexes =
  async (): Promise<BackfillReportIndexResult> => {
    const slugs = await listDirectory(["reports"]);
    let scannedSlugs = 0;
    let created = 0;
    let skippedExisting = 0;
    let skippedEmpty = 0;

    for (const slug of slugs) {
      scannedSlugs += 1;
      const existing = await readReportIndex(slug);
      if (existing) {
        skippedExisting += 1;
        continue;
      }

      const entry = await computeReportIndexFromReports(slug);
      if (!entry) {
        skippedEmpty += 1;
        continue;
      }

      await writeJsonBlob(indexPath(slug), entry);
      created += 1;
    }

    return { scannedSlugs, created, skippedExisting, skippedEmpty };
  };

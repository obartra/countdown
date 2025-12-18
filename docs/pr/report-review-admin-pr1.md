# PR 1: Report Index Infrastructure

Source of truth: `docs/design/report-review-admin.md` (PR 1 section)

## Goal
Establish a derived report index (`reports-index/<slug>.json`) so future reads are cheap, without changing any user-facing behavior.

## Changes
- Add/define report index schema stored at `reports-index/<slug>.json`
- Update `POST /v/:slug/report` to upsert the index after storing the report detail blob
- Add a one-time backfill script at `scripts/backfill-report-index.ts` to generate missing index entries from existing `reports/<slug>/` blobs
- Add tests covering:
  - index is created on first report
  - index is updated on subsequent reports
  - backfill script creates missing entries and skips existing ones

## Index schema
```json
{
  "slug": "my-countdown",
  "reportCount": 12,
  "firstReportedAt": "2025-06-01T10:00:00Z",
  "lastReportedAt": "2025-06-14T18:30:00Z",
  "lastReason": "Inappropriate content",
  "reviewed": false
}
```

## How to run the backfill (local)
This repo’s Node version supports type-stripping TypeScript execution:

```bash
COUNTDOWN_STORAGE_DIR=.netlify/published-data \
node --experimental-strip-types scripts/backfill-report-index.ts
```

Notes:
- The script is standalone (reads from the blob shim directly); no `netlify dev` needed.
- If `COUNTDOWN_STORAGE_DIR` is omitted, the default storage root is `.netlify/published-data`.
- The script only creates **missing** `reports-index/*.json` entries; it does not overwrite existing ones.

## Verification
- `pnpm types`
- `pnpm test`
- `pnpm lint`

## Acceptance criteria
- [x] Reporting (`POST /v/:slug/report`) continues to return `200` on success.
- [x] New reports create/update `reports-index/<slug>.json`.
- [x] Backfill script succeeds against a local dataset and creates missing index entries.

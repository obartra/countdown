# PR 2: Admin Reports Endpoint

Source of truth: `docs/design/report-review-admin.md` (PR 2 section)

## Goal
Expose a paginated, filterable list of reported slugs to authenticated callers.

## Changes
- Add Netlify function `admin-reports.ts` implementing `GET /admin/reports` with `x-admin-secret` authentication.
- Support `limit` (default 50, max 200), `cursor` (base64 keyset), `since` (ISO timestamp), and `reviewed` (boolean) filters.
- Read from `reports-index/` blobs primarily; lazily regenerate missing index entries from `reports/<slug>/*.json`.
- Response shape: `{ items, nextCursor, total }` with items containing `slug, reportCount, lastReportedAt, lastReason, reviewed`.
- Add redirects/proxy wiring for the endpoint.
- Tests for auth, pagination, filters, empty state, and lazy index regeneration.

## Verification
- `pnpm types`
- `pnpm test`
- `pnpm lint`

## Acceptance criteria
- [x] 401 when `x-admin-secret` is missing/invalid.
- [x] Pagination returns slices in descending `lastReportedAt` order with an opaque cursor.
- [x] `since` and `reviewed` filters applied server-side.
- [x] Empty state returns `{ items: [], nextCursor: null, total: 0 }`.
- [x] Missing indexes are regenerated from existing report blobs.

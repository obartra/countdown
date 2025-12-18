# PR 3: Admin Reports UI

Source of truth: `docs/design/report-review-admin.md` (PR 3 section)

## Goal
Provide a minimal, authenticated UI to browse and review reported slugs.

## Changes
- Add SPA route `/admin/reports` with secret prompt, filters (`since`, hide reviewed), pagination (Load more), and per-row “Mark reviewed” action.
- Add `PATCH /admin/reports/:slug` endpoint to set `reviewed: true` on the index.
- Wire redirects/proxy for the new endpoint.
- Tests: unit tests for the UI data flow, integration tests for PATCH handler.

## Verification
- `pnpm types`
- `pnpm test`
- `pnpm lint`

## Acceptance criteria
- [x] Auth required via `x-admin-secret`.
- [x] Table lists slug, counts, last reason, last reported, reviewed status.
- [x] Filters and pagination operate server-side.
- [x] Mark reviewed calls PATCH and updates UI.

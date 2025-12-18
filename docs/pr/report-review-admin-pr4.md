# PR 4: Delete & Clear Actions

Source of truth: `docs/design/report-review-admin.md` (PR 4 section)

## Goal
Allow admins to delete countdowns or clear report history with auditing.

## Changes
- Extend `DELETE /v/:slug` to accept `x-admin-override: <ADMIN_SECRET>` and bypass owner password/attempt limits; logs admin actions and includes `adminOverride: true` in the response when used.
- Add `DELETE /admin/reports/:slug` with `x-admin-secret` auth to clear report indexes (optional `?purgeBlobs=true` to remove raw report blobs) while retaining first/last report timestamps for audit context.
- Admin action logging: append entries to `logs/<date>/admin-actions.json` (JSON array per day).
- Admin UI: `/admin/reports` gains “Clear reports” and “Delete countdown” actions with confirmation modal and optimistic updates.
- Tests for admin override delete, clear-with/without purge, and logging; UI unit tests retained.

## Verification
- `pnpm types`
- `pnpm test`
- `pnpm lint`
- `npm run test:e2e` (requires permission to bind local dev ports 4173/8889)

## Acceptance criteria
- Admin override delete succeeds without owner password and is audited.
- Clearing reports resets index (and purges blobs when requested) with audit log.
- UI exposes delete/clear actions with confirmation; list refreshes accordingly.

# Report Review Admin Panel — Detailed Implementation Plan

## Overview

This plan breaks the feature into four incremental PRs, each delivering a shippable unit that can be reviewed and tested independently. The sequence minimizes risk by building the data layer first, then the read path, then the UI, and finally the advanced actions.

---

## PR 1: Report Index Infrastructure

**Goal:** Establish the derived index so future reads are cheap, without changing any user-facing behavior.

### Changes

1. **Define index schema** — Create a new blob at `reports-index/<slug>.json` containing:
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

2. **Update `POST /v/:slug/report`** — After appending the detail blob, upsert the index entry (read-modify-write with optimistic locking if the blob store supports etags, otherwise accept eventual consistency).

3. **Backfill script** — Add a one-time CLI/script (`scripts/backfill-report-index.ts`) that scans existing `reports/<slug>/` blobs and generates missing index entries. Document how to run it locally or via `netlify dev`.

4. **Unit tests** — Verify index is created on first report, updated on subsequent reports, and backfill script produces correct output for fixture data.

### Merge criteria
- Existing report flow still works.
- Index blobs appear after new reports.
- Backfill script succeeds on a test dataset.

---

## PR 2: `GET /admin/reports` Endpoint

**Goal:** Expose a paginated, filterable list of reported slugs to authenticated callers.

### Changes

1. **New Netlify Function `admin-reports.ts`** — Handles `GET /admin/reports`.

2. **Authentication** — Require `x-admin-secret` header (same as `/admin/stats`). Return `401` if missing or invalid.

3. **Query parameters**
   - `limit` (default 50, max 200)
   - `cursor` (opaque token for keyset pagination, e.g., base64-encoded `lastReportedAt + slug`)
   - `since` (ISO timestamp; only return slugs reported after this time)
   - `reviewed` (boolean filter; omit to return all)

4. **Response shape**
   ```json
   {
     "items": [
       { "slug": "...", "reportCount": 5, "lastReportedAt": "...", "lastReason": "...", "reviewed": false }
     ],
     "nextCursor": "...",
     "total": 123
   }
   ```

5. **Implementation path**
   - Primary: read from `reports-index/` blobs (list + filter in memory for now; blob stores typically support prefix listing).
   - Fallback: if index is missing for a slug found during a full scan, regenerate it lazily.

6. **Rate limiting consideration** — Document that Netlify's built-in function invocation limits apply; add a note about adding explicit rate limiting in a future iteration if needed.

7. **Tests**
   - Secret enforcement (401 without header, 200 with).
   - Pagination returns correct slices.
   - `since` filter excludes older reports.
   - Empty state returns `{ items: [], nextCursor: null, total: 0 }`.

### Merge criteria
- Endpoint deployed behind feature flag or admin path.
- Manual curl test against staging returns expected data.

---

## PR 3: Admin Reports UI

**Goal:** Provide a minimal, functional interface for reviewing reports.

### Changes

1. **Route** — Add `/admin/reports` to the SPA router (preferred over a separate HTML page to reuse existing styling and build pipeline).

2. **Authentication UX** — On page load, prompt for the admin secret (stored in session storage for convenience). Pass it via `x-admin-secret` header on all fetches.

3. **Main table view**
   - Columns: Slug (link to `/v/:slug`), Report Count, Last Reason (truncated), Last Reported, Reviewed status.
   - Sort by `lastReportedAt` descending (most recent first).
   - Infinite scroll or "Load more" button using `nextCursor`.

4. **Filters** — Date range picker (`since`), checkbox for "Hide reviewed."

5. **Row actions (view-only in this PR)**
   - **View** — Opens `/v/:slug` in new tab.
   - **Mark reviewed** — Calls a new `PATCH /admin/reports/:slug` (see below) to set `reviewed: true`.

6. **Supporting endpoint `PATCH /admin/reports/:slug`** — Updates the index blob's `reviewed` flag. Requires admin secret.

7. **Error handling** — Toast notifications for network errors, invalid secret, etc.

8. **Tests**
   - Cypress: table renders, pagination works, mark-reviewed updates UI optimistically.
   - Unit: filter logic, date formatting.

### Merge criteria
- UI accessible at `/admin/reports` on staging.
- Able to browse, filter, and mark items reviewed.

---

## PR 4: Delete & Clear Actions

**Goal:** Let admins remove countdowns or clear report history, with appropriate safeguards.

### Design decisions to resolve first

| Question | Recommended answer |
|----------|-------------------|
| How does admin delete without owner password? | Introduce `x-admin-override` header accepted by `DELETE /v/:slug` that bypasses password check when combined with valid admin secret. Document that this is a privileged operation. |
| What happens to report blobs on "Clear"? | "Clear" resets the index (`reportCount: 0`, clears `lastReason`, sets `reviewed: true`) but leaves raw blobs for audit. Add optional `DELETE /admin/reports/:slug/history` to purge blobs if retention policy requires. |
| Should we support banning? | Defer to a future PR. For now, deleting the countdown is sufficient; a `blocked` flag adds schema and enforcement complexity. |

### Changes

1. **Extend `DELETE /v/:slug`** — Accept `x-admin-override: <admin-secret>` to bypass owner password. Log override usage to `logs/` for auditing.

2. **New endpoint `DELETE /admin/reports/:slug`** — Clears the index (or deletes it entirely). Optionally accepts `?purgeBlobs=true` to also delete raw report blobs.
   - Implementation keeps `firstReportedAt`/`lastReportedAt` for audit context, while resetting counts/reason and marking `reviewed: true`.

3. **UI additions**
   - **Delete countdown** button — Confirmation modal explaining the action is irreversible, then calls `DELETE /v/:slug` with override header.
   - **Clear reports** button — Calls `DELETE /admin/reports/:slug`; refreshes row or removes it from list.

4. **Audit logging** — Append a structured entry to `logs/<date>/admin-actions.json` for every delete or clear action, including acting admin (placeholder until real auth exists), slug, and timestamp.

5. **Tests**
   - Integration: delete with override removes countdown blob.
   - Integration: clear resets index, blobs remain unless `purgeBlobs`.
   - Cypress: confirmation modal prevents accidental deletes; success toast appears.

### Merge criteria
- Deleting a reported countdown from the admin UI works end-to-end.
- Audit log entries appear.

---

## Follow-up considerations (not in scope)

These items surfaced during planning but are better handled in separate efforts:

1. **Real authentication** — Replace secret header with OAuth or Netlify Identity for multi-user admin access and audit trails.
2. **Automated flagging** — Add threshold-based auto-blocking (e.g., 10+ reports in 24 hours sets `blocked: true`).
3. **Blob storage migration** — If report volume grows significantly, consider moving index to a lightweight database (e.g., Netlify's KV or an external Postgres) for better query support.
4. **Rate limiting** — Add explicit rate limiting to `/admin/reports` to mitigate enumeration attacks if the secret leaks.

---

## Summary table

| PR | Scope | Key deliverables |
|----|-------|------------------|
| 1 | Index infrastructure | Index schema, write-path update, backfill script |
| 2 | Read endpoint | `GET /admin/reports` with pagination, filters, auth |
| 3 | Admin UI | `/admin/reports` page, table, mark-reviewed action |
| 4 | Delete & clear | Admin override delete, clear reports, audit logging |

Each PR builds on the previous one and can be deployed independently (with feature flags if needed), allowing for incremental review and reduced merge risk.

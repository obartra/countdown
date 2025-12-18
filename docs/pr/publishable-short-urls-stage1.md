## Feature: Publishable short URLs – backend & routing groundwork
Implements Phase 1 of `docs/design/publishable-short-urls.md`.

### Exact behavior
- Implement the backend contract described in `docs/design/publishable-short-urls.md` for `POST /publish`, `GET /v/:slug`, `DELETE /v/:slug`, and the scheduled cleanup, including:
  - Slug validation/normalization rules (lowercase, 3–48 chars, `[a-z0-9-]`, no leading/trailing/consecutive hyphens).
  - Anonymous slugs are random-only (8 alphanumeric chars); custom slugs require a password.
  - Password hashing before storage.
  - Canonicalization of countdown params via `buildCanonicalCountdownSearchParams` so stored state matches the viewer.
  - TTL enforcement: 30 days max for anonymous slugs, 5 years max for password-protected. Metadata tracks `timeMs`, `createdAt`, `expiresAt`, `published`, `ownerHash`.
- Create a Netlify blob-backed persistence layer for storing `meta/<slug>` and `slug/<slug>` payloads, with helper utilities for reads/writes.
- Update the SPA entrypoint (`src/main.tsx`) so visiting `/v/:slug` fetches stored canonical params, falls back to query-string parsing when the slug is missing or expired, and keeps the canonical flow identical in both cases.
- Surface slug fetch failures as a missing-countdown helper (same behavior as invalid query params).

### Notes
- No UI changes yet; this PR lays the groundwork so later PRs can add the Publish/Delete panels.
- Storage uses a local blob shim under `.netlify/published-data/{meta,slug}` for local dev; swap to production Netlify Blobs later.
- No rate limiting yet (Phase 3).

### Test plan
- `pnpm types`
- `pnpm test`
- `pnpm lint`

### Acceptance criteria
- [x] `POST /publish` creates a slug record and returns short + canonical long URLs
- [x] `POST /publish` generates random slug when none provided, requires password when custom slug provided
- [x] `POST /publish` enforces TTL limits (30 days anonymous, 5 years password-protected)
- [x] `GET /v/:slug` returns stored canonical query string + metadata when published, 404 otherwise
- [x] `DELETE /v/:slug` honors password ownership and removes blobs
- [x] Visiting `/v/:slug` fetches and renders the saved countdown
- [x] Visiting `/v/:slug` falls back to helper view when slug is missing/expired
- [x] Legacy query-param flow (`?time=...`) continues to work

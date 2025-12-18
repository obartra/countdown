## Feature: Publishable short URLs – monitoring & iteration
Implements Phase 4 of `docs/design/publishable-short-urls.md`.

### Exact behavior
- Add structured logging for abuse detection and usage insights:
  - Log all publish attempts (success, rate-limited, conflict) with timestamp, IP hash, slug type (anonymous/custom), and outcome
  - Log all delete attempts (success, failed password, locked out) with timestamp, slug, and outcome
  - Log scheduled cleanup runs with count of expired slugs removed
- Create a simple admin stats endpoint `GET /admin/stats` (protected by secret header) returning:
  - Total published slugs (active)
  - Publishes in last 24h / 7d / 30d
  - Anonymous vs password-protected breakdown
  - Rate limit hits in last 24h
  - Failed delete attempts in last 24h
- Add a `/v/:slug/report` endpoint for user abuse reports:
  - `POST /v/:slug/report` accepts `{ reason: string }` (max 500 chars)
  - Stores report in `reports/<slug>/<timestamp>` blob
  - Returns 200 OK (don't reveal if slug exists)
  - No immediate action; reports reviewed manually

### Backend changes
- Create `src/lib/logger.ts` with structured logging helpers:
  - `logPublish({ ipHash, slugType, outcome, slug? })` 
  - `logDelete({ slug, outcome })`
  - `logCleanup({ removed: number, scanned: number })`
  - Logs written to `logs/<date>/<type>-<timestamp>.json` blobs (or stdout in production for Netlify log drain)
- Create `netlify/functions/admin-stats.ts`:
  - Require `x-admin-secret` header matching env var `ADMIN_SECRET`
  - Aggregate counts from metadata blobs and rate limit data
  - Return JSON stats object
- Create `netlify/functions/report.ts`:
  - Validate slug format (but don't check existence—prevents enumeration)
  - Store report blob with timestamp and reason
  - Rate limit reports: 3 per IP per hour
- Update existing functions to call logging helpers

### UI changes
- Add "Report" link in countdown viewer footer (not in editor)
- Simple modal: "Report this countdown" with reason textarea and submit button
- Show confirmation: "Thanks for reporting. We'll review this shortly."
- No admin UI yet; stats accessed via API only

### Test plan
- Unit tests for logger helpers (correct structure, sanitization)
- Integration tests:
  - Admin stats returns correct counts
  - Admin stats rejects requests without secret header
  - Report endpoint stores report blob
  - Report endpoint rate limited
- `pnpm types`
- `pnpm test`
- `pnpm lint`

### Acceptance criteria
- [x] Publish attempts logged with outcome and metadata
- [x] Delete attempts logged with outcome
- [x] Cleanup job logs removal count
- [x] `GET /admin/stats` returns usage metrics
- [x] `GET /admin/stats` returns 401 without correct secret header
- [x] `POST /v/:slug/report` stores report blob
- [x] Report endpoint doesn't reveal slug existence
- [x] Report endpoint rate limited (3/hour per IP)
- [x] Report UI accessible from countdown viewer
- [x] Report confirmation shown after submission

### Out of scope
- Admin dashboard UI
- Automated moderation actions
- Email notifications for reports
- Log retention policies / cleanup
- Public usage statistics

### Notes
- Logging to blobs is a stopgap; move to proper log aggregation (Datadog, Netlify Log Drains) when needed
- Admin secret should be rotated periodically and stored in Netlify env vars
- Report review is manual for now; automate only if volume warrants it
- Stats endpoint is intentionally simple; expand based on what we actually need to monitor
- Consider adding Slack/Discord webhook for high-volume rate limit hits as a future enhancement

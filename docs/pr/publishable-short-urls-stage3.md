## Feature: Publishable short URLs – abuse prevention
Implements Phase 3 of `docs/design/publishable-short-urls.md`.

### Exact behavior
- Add IP-based rate limiting to `POST /publish`:
  - 10 publishes per hour per IP
  - 100 publishes per day per IP
  - Use `x-nf-client-connection-ip` header for IP identification
  - Return `429 Too Many Requests` with `Retry-After` header when exceeded
  - Include rate limit headers in all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Add password attempt limiting to `DELETE /v/:slug`:
  - 5 failed password attempts per slug per hour
  - After limit: slug locked from delete attempts for 1 hour
  - Return `429 Too Many Requests` when locked
  - Reset counter on successful delete or after window expires
- Store rate limit and attempt data in blobs:
  - `ratelimit/ip/<ip-hash>` → `{ count, windowStart }`
  - `attempts/<slug>` → `{ count, windowStart }`
  - Hash IP addresses before using as keys (privacy + key sanitation)

### Backend changes
- Create `src/lib/rateLimit.ts` with helpers:
  - `checkRateLimit(ip: string, limits: { hourly: number, daily: number })` → `{ allowed: boolean, remaining: number, resetAt: number }`
  - `recordPublish(ip: string)` → increments counters
  - `checkAttemptLimit(slug: string)` → `{ allowed: boolean, resetAt: number }`
  - `recordFailedAttempt(slug: string)` → increments counter
  - `clearAttempts(slug: string)` → called on successful delete
- Update `netlify/functions/publish.ts`:
  - Check rate limit before processing
  - Return 429 with headers if exceeded
  - Record successful publish against IP
- Update `netlify/functions/published.ts` (DELETE handler):
  - Check attempt limit before validating password
  - Record failed attempts on wrong password
  - Clear attempts on successful delete
  - Return 429 if locked out

### UI changes
- Display rate limit errors in publish panel: "Too many publishes. Try again in X minutes."
- Display lockout errors in danger zone: "Too many failed attempts. Try again in X minutes."

### Test plan
- New Vitest tests covering:
  - Rate limit logic: counter increments, window resets, limit enforcement
  - Attempt limit logic: counter increments, lockout, reset on success
  - IP hashing consistency
  - 429 responses include correct headers
- Integration tests:
  - Publish blocked after exceeding hourly limit
  - Delete blocked after 5 failed password attempts
  - Lockout expires after 1 hour
- `pnpm types`
- `pnpm test`
- `pnpm lint`

### Acceptance criteria
- [x] `POST /publish` returns 429 after 10 publishes in an hour from same IP
- [x] `POST /publish` returns 429 after 100 publishes in a day from same IP
- [x] 429 response includes `Retry-After` header with seconds until reset
- [x] All publish responses include `X-RateLimit-Remaining` header
- [x] `DELETE /v/:slug` returns 429 after 5 failed password attempts
- [x] Lockout persists for 1 hour, then resets
- [x] Successful delete clears the attempt counter
- [x] IP addresses are hashed before storage
- [x] UI displays user-friendly error messages for rate limits and lockouts

### Out of scope
- CAPTCHA or proof-of-work
- User authentication
- Content moderation / slug filtering
- Logging or analytics (Phase 4)

### Notes
- Rate limit storage uses the same blob shim as slug data for local dev
- Window-based limiting (not sliding window) for simplicity—accept minor burst edge cases
- Consider moving to Redis or similar if blob read/write latency becomes an issue at scale

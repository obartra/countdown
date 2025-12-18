# Publishable Short URLs

## Summary
Enable a short-form publishing workflow on top of the existing query-parameter countdown sharing. In addition to the current `?time=...&title=...` URLs, users can "publish" a countdown with a minimal tag (`/v/:slug`) that resolves to canonical parameters stored in a tiny persistence layer (Netlify Blobs). The editor would gain a Publish/Delete flow, optional custom slug/password handling, and a rule set for TTL/expiration so published timers can be managed while the query-param paths continue to work as today.

## Current state
- Backend + storage implemented: Netlify Functions (`/publish`, `/v/:slug` GET/DELETE, `/admin-stats`, `/report`, `/admin/reports*`) backed by a local blob shim at `.netlify/published-data`. Publish stores canonical params via `buildCanonicalCountdownSearchParams`; metadata includes `slug, ownerHash?, published, createdAt, timeMs, expiresAt`.  
- Routing: `/v/:slug` fetches stored params; if missing/expired, the SPA falls back to query-param parsing. Editor lazy-loads; `/v/:slug/edit` and `?edit` force editor.  
- UI: EditPage has Publish panel (slug/password validation, TTL messaging, copy/view short URL) and danger zone delete (slug confirm; password once to unlock). Password-protected slugs gate edit/delete until password is entered.  
- TTL: anonymous random slugs expire at 30 days; password-protected up to 5 years. Cleanup function deletes expired or payload-missing slugs.  
- Abuse/reporting: publish rate limits (10/hour, 100/day), delete attempt limits (5 failures/hour), report endpoint with its own limits + admin reports/stats endpoints.  
- Canonicalization: URL defaults handled via `src/countdownUrl.ts`; query overrides merge over stored payload when viewing `/v/:slug`.

## Proposed direction
1. Keep the query-parameter workflow as-is (no breaking changes); it remains the "fallback" when no stored countdown exists for the visited slug.  
2. Introduce a lightweight "publish" backend (Netlify Function + Blobs) that maps short IDs to canonical countdown parameters, creation metadata, expiration, owner password, and optional "deleted" flag.  
3. Add Publish/Delete UI controls to `EditPage`:
   * Support a default anonymous slug (randomly generated) and optional custom slug+password pair.
   * Validate slug uniqueness via the backend (error states for invalid/used names).  
   * Enforce password requirement when a custom slug is provided; store the hash of the password as the owner credential.  
   * Once published, allow the user to "unpublish/delete" by confirming the slug; password-protected slugs require the owner password (entered once to unlock owner access).  
   * Ensure the existing canonicalization helpers are used before saving so the stored parameters correspond exactly to what the viewer would render.
4. Route matching:
   * Use `/v/:slug` prefix for published countdowns to avoid conflicts with reserved paths.
   * When visiting `/v/some-id`, call the backend to fetch stored canonical params; fall back to query-param parsing if the slug is absent.  
   * When a slug payload exists, treat URL query params as a patch over the stored payload (query params override stored values for keys present in the URL).  
   * If nothing is stored (invalid slug or defaults-only), stay on the editor view (just like missing required params today).  
5. Lifecycle rules (implemented):  
   * Reject anonymous publishes whose `time` would schedule more than 30 days ahead; random slugs created without a password are capped at 30-day TTL.  
   * Allow password-protected custom slugs up to five years; enforce five-year maximum on every publish.  
   * Cleanup deletes when `expiresAt <= now` (no +1 year grace).  
   * UI delete removes blobs immediately; admin override can also delete.

## Alternatives considered
- Keep everything client-side and encode a long state blob after `/:id`; this avoids backend work but conflicts with "very short URL" requirement and makes revocation impossible.  
- Offer a publish-once approach without password and rely on e-mail links; that simplifies UI but doesn't meet the security requirement around custom slugs/passwords.  
- Build a full authentication layer instead of password-on-slug. That adds complexity and probably exceeds scope for a quick "Netlify/DB" addition.
- Use top-level `/:slug` routing instead of `/v/:slug`; this requires maintaining a blocklist of reserved names (`robots.txt`, `favicon.ico`, `.well-known`, `edit`, `api`, etc.) and risks future conflicts. The `/v/` prefix is one character and eliminates this class of problems entirely.

## Risks / unknowns
- The existing deployment is a purely static Vite SPA (`package.json` scripts, no backend), so introducing persistence requires a new service (Netlify Functions) and careful CORS/auth handling.  
- Password management needs security thought even if it's just hashed strings; storing plaintext passwords in a public bucket or log would be unacceptable.  
- Synchronizing canonicalization between frontend and backend is critical; the backend must apply the same `buildCanonicalCountdownSearchParams` logic (`src/countdownUrl.ts`) so `/v/slug` always renders the same preview as the canonical query string.  
- TTL/cleanup rules imply a scheduler or lifecycle runner via Netlify Scheduled Functions.  
- A published countdown should still respect the URL canonicalization process in `src/main.tsx` and `src/hooks/useCountdownViewModel.ts`, so the UI doesn't inadvertently mutate stored parameters on load.

## Decisions and answers
1. **Storage** – Use **Netlify Blobs + Netlify Functions** for MVP since Blobs behave like simple key/value storage and deploys inside the existing Netlify environment. Schedule cleanup/TTL via **Netlify Scheduled Functions** and expose a local `.netlify/published-data/{meta,slug}` shim for dev.
2. **Slug ownership** – Enforce **global uniqueness**; the slug itself is the resource and password-as-owner only makes sense if each slug maps to one countdown.
3. **URL structure** – Use `/v/:slug` prefix for all published countdowns. This avoids reserved name conflicts and simplifies routing.
4. **Slug validation** – Normalize to lowercase, 3–48 characters, allow `[a-z0-9-]`, forbid leading/trailing/consecutive `-`. No reserved names needed due to `/v/` prefix.
5. **Concurrency** – Don't rely solely on preflight availability. `POST /publish` must return `409 Conflict` if the slug already exists, except allow overwriting an existing password-protected slug when the provided password matches the stored owner hash. Netlify Blobs are last-write-wins with no transactional guarantees, so accept the minimal race risk for now but always do a strong read after write.
6. **TTL policy** – Anonymous slugs are random-only and expire after 30 days; password-protected custom slugs can live up to five years. Scheduled cleanup should delete entries when `timeMs + 1 year` passes so slugs can be reclaimed.
6. **Password UI** – Add an inline "Publish" panel in the editor with slug/password inputs, availability feedback, and a "Danger zone" section after publishing for unpublish/delete.
7. **Publish response** – Have the backend return both the `shortUrl` (like `https://donja.love/v/abc123`) and the canonical `longUrl`, plus optional `expiresAt`. Highlight/copy the short URL prominently in the Publish UI.
8. **Slug editing defaults** – When editing a published slug (`/v/:slug/edit`), the stored payload acts as a secondary defaults layer. The editor URL should contain only overrides compared to the stored payload so `/v/:slug/edit` stays clean while still supporting shareable patches via query params.

## Abuse prevention

### Threat model

| Threat | Severity | Likelihood | Mitigation |
|--------|----------|------------|------------|
| Spam/SEO abuse | Medium | Medium | Rate limiting, short TTL for anonymous slugs |
| Slug squatting | Low | High | Anonymous slugs are random-only; custom slugs require password |
| Storage exhaustion | Low | Low | TTL enforcement, scheduled cleanup |
| Password brute-forcing | Medium | Low | Attempt limiting on delete endpoint |
| Offensive slugs | Low | Medium | Monitor; add reporting if needed |

### Rate limiting

Limit publish requests by IP to prevent bulk creation:
- 10 publishes per hour per IP
- 100 publishes per day per IP

Implementation uses `x-nf-client-connection-ip` header. Exceeded limits return `429 Too Many Requests` with `Retry-After` header.

### Slug policy by type

| Slug Type | Custom Slug? | Min Length | Max TTL | Notes |
|-----------|--------------|------------|---------|-------|
| Anonymous | No (random only) | N/A | 30 days | 8 random alphanumeric chars |
| Password-protected | Yes | 3 chars | 5 years | User chooses slug |

Rationale: Anonymous slugs being random-only eliminates squatting. Users wanting a custom slug must provide a password, creating friction and establishing ownership.

### Password attempt limiting

Prevent brute-force attacks on delete:
- 5 failed attempts per slug per hour
- After limit: slug locked from delete attempts for 1 hour

Track attempts in blob storage keyed by slug. Return `429` when locked.

### What we're not doing (yet)

| Measure | Rationale |
|---------|-----------|
| User authentication | Password-per-slug sufficient for this use case |
| CAPTCHA | Rate limits should suffice at current scale |
| Content moderation | Countdowns have minimal UGC; add report button if abuse emerges |
| Slug content filtering | Low risk given short TTLs; revisit if offensive slugs become a problem |

## High-level implementation plan

### Phase 1: Backend contract & routing groundwork

Define a RESTful surface backed by Netlify Functions/Blobs:

* `POST /publish`: accepts `{ canonicalSearch, slug?, password? }`, canonicalizes params using the same helpers as the SPA, enforces slug validation rules, hashes the password when provided, ensures `time` is ≤5 years ahead (or ≤30 days for anonymous), writes to blobs (`meta/<slug>` for owner/expiry/published flag, `slug/<slug>` for the canonical query params), and returns `shortUrl`, `longUrl`, and `expiresAt`. Respond `409` if the slug already exists, except allow overwriting an existing password-protected slug when the provided password matches the stored owner hash.
* `GET /v/:slug`: fetches `slug/<slug>` and `meta/<slug>`, returns canonical params if published and not deleted, otherwise 404 so the SPA falls back to query params.
* `DELETE /v/:slug`: requires the owner password (if set), marks the entry deleted, and removes blobs.
* Scheduled cleanup function scans stored metadata, deletes expired timers, and clears orphaned slugs.
* Use `.netlify/published-data/{meta,slug}` as a local shim for dev/test environments before wiring up the real Netlify Blobs.

Update `src/main.tsx` to detect `/v/:slug`, fetch stored params, and fall back to query params if fetch fails.

Metadata model: `{ slug, ownerHash?, published: true/false, expiresAt, createdAt, timeMs }`.

### Phase 2: Publish/delete UI & tests

Extend `src/EditPage.tsx` with a Publish panel:
- Slug input (optional) and password input (required when custom slug provided)
- Inline validation mirroring backend rules
- Publish button with status feedback
- On success: display short URL with copy/view controls
- "Danger zone" section for delete/unpublish

Add Vitest tests covering slug normalization, API routes, and fallback behavior.

### Phase 3: Abuse prevention

Implement rate limiting and attempt limiting:
- Add IP-based rate limiting to `POST /publish` (10/hour, 100/day)
- Add attempt limiting to `DELETE /v/:slug` (5 failures/hour per slug)
- Enforce 30-day TTL for anonymous slugs, 5-year max for password-protected
- Add rate limit headers to responses (`X-RateLimit-Remaining`, `Retry-After`)

Storage for rate/attempt tracking:
```
ratelimit/ip/<ip-hash> → { count, windowStart }
attempts/<slug> → { count, windowStart }
```

### Phase 4: Monitoring & iteration

- Add basic logging for abuse detection (publish counts, failed deletes)
- Monitor actual usage patterns
- Adjust rate limits based on real data
- Consider adding report endpoint if offensive content becomes an issue

## Testing / docs

Add integration tests (Vitest with mocked backend) to verify:
- Edit/publish flows
- Slug validation and normalization
- Rate limit behavior
- Password attempt limiting
- Fallback behavior when slug not found

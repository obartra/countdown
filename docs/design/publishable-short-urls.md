# Publishable Short URLs (Draft)

## Summary
Enable a short-form publishing workflow on top of the existing query-parameter countdown sharing. In addition to the current `?time=...&title=...` URLs, users can “publish” a countdown with a minimal tag (`/:id`) that resolves to canonical parameters stored in a tiny persistence layer (Netlify KV, Fauna, Airtable, etc.). The editor would gain a Publish/Delete flow, optional custom slug/password handling, and a rule set for TTL/expiration so published timers can be managed while the query-param paths continue to work as today.

## Current state
- The viewer/editor read/write all countdown configuration via query strings (`src/countdown.ts`, `src/countdownUrl.ts`), canonicalizing colors/time/complete text so defaults don’t pollute the URL. `parseParamsFromSearch` and `buildCanonicalCountdownSearchParams` are the single sources of truth for parsing and serializing (also used by `src/main.tsx` to canonicalize `location.search` before rendering).  
- The editor mirrors the form controls into the URL live and renders either the helper form or the countdown preview depending on validity (`src/EditPage.tsx`, `src/components/CountdownPreview.tsx`).  
- Routing is straightforward: `/edit` path shows the editor, all other paths render the countdown, and there is no server-side logic. Everything lives in the SPA and relies on query parameters; there is no persistence beyond the URL.

## Proposed direction
1. Keep the query-parameter workflow as-is (no breaking changes); it remains the “fallback” when no stored countdown exists for the visited slug.  
2. Introduce a lightweight “publish” backend (Netlify Function + KV, Fauna, etc.) that maps short IDs to canonical countdown parameters, creation metadata, expiration, owner password, and optional “deleted” flag.  
3. Add Publish/Delete UI controls to `EditPage`:
   * Support a default anonymous slug (maybe generated from a short hash) and optional custom slug+password pair.
   * Validate slug uniqueness via the backend (error states for invalid/used names).  
   * Enforce password requirement when a custom slug is provided; store the hash of the password as the owner credential.  
   * Once published, allow the user to “unpublish/delete” by re-entering the password.  
   * Ensure the existing canonicalization helpers are used before saving so the stored parameters correspond exactly to what the viewer would render.
4. Route matching:
   * When visiting `/some-id`, call the backend to fetch stored canonical params; fall back to query-param parsing if the slug is absent.  
   * If nothing is stored (invalid slug or defaults-only), stay on the editor view (just like missing required params today).  
5. Lifecycle rules:  
   * Reject publish requests whose `time` is more than five years in the future.  
   * Auto-delete/soft-delete expired timers after one year.  
   * Immediately unclaim IDs when a user deletes a published entry.

## Alternatives considered
- Keep everything client-side and encode a long state blob after `/:id`; this avoids backend work but conflicts with “very short URL” requirement and makes revocation impossible.  
- Offer a publish-once approach without password and rely on e-mail links; that simplifies UI but doesn’t meet the security requirement around custom slugs/passwords.  
- Build a full authentication layer instead of password-on-slug. That adds complexity and probably exceeds scope for a quick “Netlify/DB” addition.

## Risks / unknowns
- The existing deployment is a purely static Vite SPA (`package.json` scripts, no backend), so introducing persistence requires a new service (Netlify Functions, Fauna, Airtable, etc.) and careful CORS/auth handling.  
- Password management needs security thought even if it’s just hashed strings; storing plaintext passwords in a public bucket or log would be unacceptable.  
- Synchronizing canonicalization between frontend and backend is critical; the backend must apply the same `buildCanonicalCountdownSearchParams` logic (`src/countdownUrl.ts`) so `/slug` always renders the same preview as the canonical query string.  
- TTL/cleanup rules imply a scheduler or lifecycle runner; solutions range from Netlify Scheduled Functions to a cron job, and the design should pick whichever matches the hosting environment.  
- A published countdown should still respect the URL canonicalization process in `src/main.tsx` and `src/hooks/useCountdownViewModel.ts`, so the UI doesn’t inadvertently mutate stored parameters on load.

## Decisions and answers
1. **Storage** – Use **Netlify Blobs + Netlify Functions** for MVP since Blobs behave like simple key/value storage and deploys inside the existing Netlify environment. Avoid Fauna due to its announced shutdown. Schedule cleanup/TTL via **Netlify Scheduled Functions**.
2. **Slug ownership** – Enforce **global uniqueness**; the slug itself is the resource and password-as-owner only makes sense if each slug maps to one countdown.
3. **Slug validation** – Normalize to lowercase, 3–32 characters (or up to 48 for friendlier names), allow `[a-z0-9-]`, forbid leading/trailing/consecutive `-`, and reserve names like `edit`, `api`, `assets`, `functions`, `admin`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `.well-known`, etc.
4. **Concurrency** – Don’t rely solely on preflight availability. `POST /publish` must return `409 Conflict` if the slug already exists. Netlify Blobs are last-write-wins with no transactional guarantees, so accept the minimal race risk for now but always do a strong read after write; if atomicity becomes important, move slug indices into a datastore with uniqueness constraints (Postgres/Neon via Netlify DB) and keep payloads in Blobs.
5. **Password UI** – Add an inline “Publish” panel in the editor with slug/password inputs, availability feedback, and a “Danger zone” section after publishing for unpublish/delete.
6. **Publish response** – Have the backend return both the `shortUrl` (like `https://donja.love/abc123`) and the canonical `longUrl`, plus optional `expiresAt`. Highlight/copy the short URL prominently in the Publish UI.

## High-level implementation plan
1. **Backend contract**: Define a RESTful surface backed by Netlify Functions/Blobs:
   * `POST /publish`: accepts `{ slug?, params, password? }`, canonicalizes `params` using the same helpers as the SPA, enforces slug validation rules, hashes the password when provided, ensures `time` is ≤5 years ahead, writes to two blobs (`meta/<slug>` for owner/expiry/published flag, `slug/<slug>` for the canonical query params), and returns `shortUrl`, `longUrl`, and `expiresAt`. Respond `409` if the slug already exists.
   * `GET /p/:slug`: fetches `slug/<slug>` and `meta/<slug>`, returns canonical params if published and not deleted, otherwise 404 so the SPA falls back to query params (or the helper view if nothing is present).
   * `DELETE /p/:slug`: requires the owner password, marks the entry “unpublished”/deleted in `meta/<slug>`, and optionally deletes the blobs outright.
   * Scheduled cleanup function (Netlify Scheduled Function) scans stored metadata, deletes expired timers older than 1 year past `time`, and clears any orphaned slugs.
   * Metadata model: `{ slug, ownerHash?, published: true/false, expiresAt, createdAt, timeMs }` plus the canonical query string payload, ensuring each slug identifies a single countdown and the password is the owner's credential.
2. **Editor UI**: Extend `src/EditPage.tsx` to show Publish UI with slug/password inputs, enforce global slug uniqueness by deferring to `POST /publish`, require a password for any custom slug (and hash it before saving), call the backend for publish/delete actions, and surface errors/success states without changing the canonicalization logic.
3. **Route handling**: Update `src/main.tsx` to detect `/edit` vs `/:slug`, fetch stored params when `/slug` is hit, and fall back to query params if fetch fails. Specifically:
   * Parse the pathname; if it’s `/edit` keep the existing editor flow (`focus on helper when needed`).  
   * For `/:slug`, call `GET /p/:slug` to retrieve canonical query params and metadata; if the response is 404 or the timer is unpublished, fall back to the current query-string parsing (and show the helper view if required).  
   * Canonicalize the fetched params with `buildCanonicalCountdownSearchParams` so the viewer/editor always work off the same normalized data and the body background/text colors stay in sync (`useCountdownViewModel` already applies body styles).  
   * Pass the resolved canonical params into `useCountdownViewModel`, `CountdownPreview`, and the helper form so previews and helper errors remain consistent whether navigation came from `/slug` or `?time=...`.  
4. **Lifecycle enforcement**: Encode TTL rules both in the backend and the SPA:
   * The publish endpoint validates `time` before saving and rejects any countdown scheduled beyond five years from now.
   * Metadata stores the countdown target (`timeMs`) so scheduled cleanup can compare against `now`.
   * Use a Netlify Scheduled Function to enumerate `meta/<slug>` blobs (hourly/daily), delete blobs whose `timeMs + 1 year` has passed, and reclaim any slugs whose corresponding `slug/<slug>` payload is missing.
   * Deletion/unpublish through the UI immediately removes both blobs so the slug becomes available.
   * The frontend treats stale fetch responses (older than `timeMs + 1 year`) as “missing data” and opens the helper/editor view rather than rendering an expired countdown.
5. **Testing / docs**: Add integration tests (unit or cypress mocked backend) to verify edit/publish flows, slug validation, and fallback behavior. Update docs/design/ (this very doc) once direction is finalized.  

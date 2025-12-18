## Feature: Publishable short URLs – publish/delete UI & tests
Implements Phase 2 of `docs/design/publishable-short-urls.md`.

### Exact behavior
- Add a "Publish" panel to `src/EditPage.tsx` alongside the existing Share row:
  - Slug input (optional) and password input (required only when custom slug is provided).
  - Inline validation mirroring backend slug rules (lowercase, 3–48 chars, `[a-z0-9-]`, no leading/trailing/consecutive hyphens).
  - Publish button that POSTs `{ canonicalSearch, slug?, password? }` to `/publish`, handles status codes, and shows success/error feedback.
  - On success: display the returned short URL (`/v/:slug`) with copy/view controls, plus the canonical long URL.
  - "Danger zone" section for deleting/unpublishing—requires typing the slug to confirm deletion (no password re-entry once owner access is unlocked).
- Use `canonicalCountdownSearchParams` before publishing so stored payload matches what the viewer renders.
- Existing share link section remains unchanged.

### UI notes
- Use shared `Input` and `Button` components.
- Show status text under publish button (`Publishing…`, success, or error).
- Short URL copy via `ShareLinkActions`; delete action in a visually distinct danger zone.
- When slug input is empty, show placeholder indicating a random slug will be generated.
- Display TTL info: "Expires in 30 days" for anonymous, "Expires in X" (based on countdown time) for protected.

### Test plan
- New Vitest tests covering:
  - Slug normalization rules and helpers (`src/lib/slug.test.ts`)
  - `netlify/functions/publish.ts` and `netlify/functions/published.ts` against local blob shim
  - Success, conflict, and error cases; password-guarded delete; slug fetch fallback
- `pnpm types`
- `pnpm test`
- `pnpm lint`

### Acceptance criteria
- [x] Publish panel appears in EditPage below existing Share section
- [x] Empty slug input + no password → publishes with random slug, 30-day TTL
- [x] Custom slug without password → validation error shown inline
- [x] Custom slug with password → publishes successfully
- [x] `409 Conflict` displays "slug already taken" error
- [x] On successful publish, short URL is displayed and copyable
- [x] Danger zone requires typing the slug to confirm deletion
- [x] Successful delete clears publish state and shows confirmation

### Out of scope
- Rate limiting on publish endpoint (Phase 3)
- Password attempt limiting (Phase 3)
- Analytics or usage tracking

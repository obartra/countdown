## Feature: Publishable short URLs – slug as secondary defaults + republish updates
Implements an additional phase on top of `docs/design/publishable-short-urls.md`.

### Summary
When editing or viewing a published slug (`/v/:slug` and `/v/:slug/edit`), treat the stored canonical payload as a **secondary default layer**:

1) Apply shared defaults (viewer/editor defaults)  
2) Apply stored slug payload  
3) Apply query-string params as overrides (only for keys present in the URL)

This keeps `/v/:slug/edit` clean (no long query string) while still allowing users to tweak values and share a “patch” via query params.

### Exact behavior (contract)

#### Merging rules (viewer + editor)
- When `slugPayload` exists, compute the effective params by merging:
  - Base = slug payload params
  - Overrides = current URL search params
  - For countdown keys (`time`, `title`, `description`, `footer`, `complete`, `image`, `bgcolor`, `color`):
    - If an override key is present, it wins (even if the value is empty).
    - Otherwise fall back to the slug payload value.
  - Non-countdown params (e.g. `edit`) are preserved from the URL.

#### URL writing rules (editor only)
- On `/v/:slug/edit`, the editor updates `window.location.search` on every edit change to contain **only the overrides** compared to the stored slug payload:
  - If the current canonical value equals the stored payload value, omit the key.
  - If the current canonical value is “default/omitted” but the stored payload had a value, write the key with an empty value (`key=`) to represent clearing back to default.
- Result: visiting `/v/:slug/edit` with no overrides keeps the URL query string empty (no `?time=...`).

#### Republishing (updating an existing slug)
- `POST /publish` supports **updating** an existing published slug **only when it is password-protected** and the request password matches the stored owner hash:
  - The payload is overwritten with the provided `canonicalSearch`.
  - TTL is recalculated the same way as a normal publish (5 years from publish time).
  - Response remains `200` with the same shape as create.
- Anonymous (passwordless) slugs remain immutable: attempting to publish an existing anonymous slug still returns `409`.
- After a successful republish from `/v/:slug/edit`, the editor treats the newly published payload as the new slug-default baseline; the URL overrides clear when they match the stored payload.

### Files to touch
- `src/countdownUrl.ts` – add helpers to merge slug payload + overrides and to compute override-only search strings.
- `src/main.tsx` – merge stored payload with URL overrides for `/v/:slug` and `/v/:slug/edit`; pass stored payload to the editor.
- `src/EditPage.tsx` – write override-only query params when editing a slug; clear overrides after successful republish update.
- `netlify/functions/publish.ts` – allow overwrite for existing protected slugs when password matches.

### Verification
- `pnpm types`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e` (local)

### Acceptance criteria
- [ ] Visiting `/v/:slug/edit` does not append `?time=...` when the editor state matches the stored slug payload
- [ ] Query params on `/v/:slug` and `/v/:slug/edit` override the stored payload (for keys present)
- [ ] Editor writes only overrides (diff) into the URL when editing a slug
- [ ] Republishing an existing password-protected slug updates the stored payload (no 409 conflict)
- [ ] Republishing clears URL overrides when the stored payload matches the current state
- [ ] Unit tests cover override URL helpers
- [ ] Integration tests cover republish update behavior in `POST /publish`
- [ ] Cypress e2e covers publish → view → edit → republish → verify viewer updated → delete cleanup


# External Image Search for Countdown (proposal)

## Summary
Replace the legacy `/emojis/{name}.svg` flow with a simple search-and-select experience in the editor backed by an external image API. Users can search, preview, and attach an image; the viewer renders the chosen asset. If an SVG-first API is not feasible, fall back to a GIF/animated source (e.g., Tenor). URLs remain the contract (store the image URL or ID), and README/instructions stay consistent with the shipped behavior.

## Current State (evidence)
- Image param is a freeform `image` string; the viewer/editor assume local SVGs at `/emojis/{name}.svg`:
  - Viewer loads `src` as `${import.meta.env.BASE_URL}emojis/${params.image}.svg` (`src/App.tsx`).
  - Editor preview uses the same path (`src/EditPage.tsx`).
  - Static instructions script expects `./emojis/{name}.svg` if `image` is set (`docs/script.js`).
- Build/dev middleware serves `/emojis` from `docs/emojis` (`vite.config.ts`), but that folder is absent in the repo (no assets to render).
- README and `src/template.html` document `image` as an emoji name from the (missing) list.
- Architecture: Vite SPA, lazy-loaded editor, no routing; deploy base `/countdown/` (`vite.config.ts`). Network access is restricted in the current harness, so external API calls will need explicit allowance/keys from the user.

## Proposed Direction (default)
- Use an external image provider with a JSON search API. Preferred: SVG/illustration catalog; fallback: Tenor/Giphy (GIF/WebP) if SVG is weak. Store the selected asset as `provider:id` in the `image` query param; render from the resolved provider URL.
- Editor:
  - Replace the plain text image input with a search field and results grid (thumbnails), supporting debounce and pagination/“load more”.
  - Selecting a result writes `provider:id` into the `image` param; preview renders from the resolved URL.
  - Include a “clear image” action.
- Viewer:
  - Render `image` by resolving `provider:id` to a provider URL (no `/emojis` prefix). Preserve existing show/hide rules (hide when absent or helper state). Enforce a max width/height to avoid scrollbars.
- Docs:
  - Update README and instructions to describe the new `image` contract (`provider:id`) and note any requirements (e.g., API key placement).
- Keys/config:
  - If the provider requires a key, allow configuration via a gitignored `.env` (e.g., `VITE_IMAGE_API_KEY`), documented for local/dev and Netlify env. Keys can live client-side; a serverless proxy is optional if needed.

## Alternatives
- Host a fixed curated SVG pack in-repo and skip external APIs (smaller scope, no search, fewer vibes).
- Use Openverse/Unsplash-style search for static images (larger payloads; licensing diligence needed).
- Keep emoji text list and map to a public CDN (e.g., OpenMoji) without search UI (minimal change, less user-friendly).

## Risks / Unknowns
- API choice/licensing: need permissive usage for embedding; SVG sources may be limited compared to GIF libraries.
- Network/access: external fetches may be blocked in some environments; need graceful failure and offline behavior.
- Payload/perf: loading external images (especially animated) can bloat page weight; need sizing/compression controls.
- Security: rendering arbitrary external URLs—must sanitize/validate to avoid obvious injection vectors.
- Persistence: Provider changes or expired URLs could break old links; prefer stable URLs/IDs.

## Decisions
- Provider: Prefer a free SVG search API; if not feasible, use Tenor/Giphy. Licensing must allow non-commercial use; if attribution is required, display a small footnote when rendering provider assets.
- Animation: GIFs/WebP/animated assets are fine.
- Param format: Only `provider:id` from a limited allowlist; validate ID format per provider when possible.
- Caching: Client-only search; no server cache/infra.
- Size constraints: Enforce max width/height on rendered images to prevent scrollbars; otherwise user-controlled.
- Keys: Use a gitignored `.env` (e.g., `VITE_IMAGE_API_KEY`); deploy via env injection (e.g., Netlify). Client-side keys are acceptable; a serverless proxy is optional.

## Provider Selection (locked)
- Static/SVG: **Openverse** API (e.g., `https://api.openverse.engineering/v1/images` with `q`, `extension=svg`, `license=pdm,cc0,by,by-sa,by-nd`). Provides attribution metadata; we must show a small footnote (≤50px) with title/creator/source in theme colors, lightly contrasted.
- Animated/stickers: **Tenor** API (e.g., `https://g.tenor.com/v1/search` with `q`, `searchfilter=sticker` to favor sticker-style results; `contentfilter` optional toggle, default off; `media_filter` as needed). Requires API key; show a small “Powered by Tenor” attribution footnote.
- Param format: `provider:id` with allowlist (`openverse`, `tenor`) and ID validation per provider.
- Keys: `VITE_IMAGE_API_KEY_OPENVERSE` (optional if needed) and `VITE_IMAGE_API_KEY_TENOR` in gitignored `.env`; deploy via env injection. Client-side is acceptable; proxy optional.

### Provider contracts (concrete)
- Allowlist: `openverse`, `tenor`.
- ID schema:
  - `openverse:<uuid>` where `<uuid>` is the Openverse image `id` (UUID v4 string). Validation: `/^[0-9a-fA-F-]{36}$/`.
  - `tenor:<id>` where `<id>` is the Tenor result `id` (alphanumeric); validation: `/^[A-Za-z0-9_-]+$/`.
- Search endpoints:
  - Openverse: `GET https://api.openverse.engineering/v1/images?q={query}&extension=svg&license=pdm,cc0,by,by-sa,by-nd&page={page}&page_size={n}`; key optional via `Authorization: Bearer <key>` if provided.
  - Tenor: `GET https://g.tenor.com/v1/search?q={query}&searchfilter=sticker&limit={n}&pos={cursor}&key=${VITE_IMAGE_API_KEY_TENOR}` (optionally include `contentfilter=off|high` toggle and `media_filter` to trim payload).
- Resolution (rendering):
  - `openverse:id` → fetch metadata via Openverse detail endpoint (`/v1/images/{id}`) to obtain a direct URL; render that URL.
  - `tenor:id` → fetch detail endpoint (`https://g.tenor.com/v1/gifs?ids={id}&key=...`) to obtain `media_formats` and pick a preferred format (e.g., GIF/WebP/MP4). Cache result client-side per session.
- Attribution requirements:
  - Openverse/CC: display creator/title/source in a ≤50px footnote, theme-colored with slight contrast adjustment.
  - Tenor: display “Powered by Tenor” footnote (≤50px), theme-colored with slight contrast adjustment.
- Key placement: `.env` (gitignored) with `VITE_IMAGE_API_KEY_TENOR` (required) and `VITE_IMAGE_API_KEY_OPENVERSE` (optional). Document injection for Netlify/host; client-side usage is acceptable per requirements.

## Remaining Open Questions
- None beyond implementation details; attribution placement defined (≤50px footnote with theme-aware colors and slight contrast).

## High-Level Implementation Plan (PR-sized steps)
1) Provider decision & contracts: pick API, define `provider:id` schema and allowlist, document key placement; note licensing/attribution requirements.
2) Viewer change: update `App` to resolve `provider:id` to a URL (no `/emojis`), with validation and max sizing; render attribution if required.
3) Editor search UI: replace the emoji text box with a search + results picker (Openverse SVG + Tenor stickers), optional safety filter toggle, selection state, and clear action; persist `provider:id` to URL.
4) Instructions/README: update parameter docs to match the new image contract and remove references to missing local emojis.
5) Tests: add RTL coverage for viewer rendering with resolved URLs, editor search selection mock, URL sync, and attribution if applicable; adjust any Cypress flows accordingly.
6) Follow-up (optional): graceful offline/error state for search, caching/batching requests, and telemetry for failures if desired.***

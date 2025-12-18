# External Image Search for Countdown

## Summary
Implemented: editor image search uses Openverse (static/SVG) and Tenor (stickers) with `provider:id` values stored in the `image` param. Viewer resolves and renders provider assets with attribution.

## Current State (evidence)
- Param format: `image=provider:id` with allowlist `openverse` (UUID) and `tenor` (id). Validation and resolution live in `src/imageResolver.ts`.  
- Viewer resolution: fetch provider detail (Openverse/Tenor) and render resolved URL; Tenor attribution rendered (“Powered by Tenor”).  
- Editor search UI: `src/EditPage.tsx` integrates Openverse + Tenor search (pagination/load more/clear) and writes `provider:id` to URL; manual input still allowed.  
- Env/config: `VITE_IMAGE_API_KEY_TENOR` required; optional `VITE_OPENVERSE_BASE`. Requests are client-side; Tenor base configurable.  
- Docs/template: README and `src/template.html` describe provider:id contract.

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
- Provider allowlist locked to `openverse` and `tenor`; IDs validated per provider.
- Param format remains `provider:id`; resolution + attribution handled client-side.
- Client-only search/resolution; no server cache.
- Enforce max width/height; animated assets allowed.
- Keys: `VITE_IMAGE_API_KEY_TENOR` required; Openverse base configurable.

## Provider Selection (locked)
- Static/SVG: **Openverse** API (`https://api.openverse.engineering/v1/images` with `q`, `extension=svg`, `license=...`). Provides attribution metadata; we show a small footnote when provided.
- Animated/stickers: **Tenor** API (`https://tenor.googleapis.com/v2/search` with `q`, `limit`, `pos`, `client_key=${VITE_TENOR_CLIENT_KEY || VITE_IMAGE_API_KEY_TENOR}`). Requires API key; “Powered by Tenor” attribution shown.
- Param format: `provider:id` with allowlist (`openverse`, `tenor`) and ID validation per provider.
- Keys: `VITE_IMAGE_API_KEY_OPENVERSE` (optional if needed) and `VITE_IMAGE_API_KEY_TENOR` in gitignored `.env`; deploy via env injection. Client-side is acceptable; proxy optional.

### Provider contracts (concrete)
- Allowlist: `openverse`, `tenor`.
- ID schema:
  - `openverse:<uuid>` where `<uuid>` is the Openverse image `id` (UUID v4 string). Validation: `/^[0-9a-fA-F-]{36}$/`.
  - `tenor:<id>` where `<id>` is the Tenor result `id` (alphanumeric); validation: `/^[A-Za-z0-9_-]+$/`.
- Search endpoints:
  - Openverse: `GET https://api.openverse.engineering/v1/images?q={query}&extension=svg&license=pdm,cc0,by,by-sa,by-nd&page={page}&page_size={n}`; key optional.
  - Tenor: `GET https://tenor.googleapis.com/v2/search?q={query}&limit={n}&pos={cursor}&key=${VITE_IMAGE_API_KEY_TENOR}` (content filter high by default).
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

# Countdown Parameter Editor

## Current State
- Full editor implemented (`src/EditPage.tsx`), lazy-loaded via `React.lazy` from `src/main.tsx`; viewer/editor share canonical params and live preview.
- Form covers time/date, title, description, footer, complete text, colors/themes, image search (Openverse/Tenor), publish/delete, and share/copy flows.
- Instructions page is generated but primary UX is the editor; URLs remain the contract (canonicalized via `src/countdownUrl.ts`).
- Data model via `parseParamsFromSearch`/`deriveCountdownMeta`; colors/themes resolved via `resolveThemeTokens`.
- Tests: Vitest + Cypress cover editor flows, share/publish/delete, image search, and routing.

## Goals
- Keep the editor current: preserve live preview, URL contract, publish/delete flows, and image/theme selection UX.
- Ensure mobile/desktop responsive layout and accessible form controls (date picker, color/theme selector, image search).
- Make sharing and publishing easy (copy short URL, view link, danger zone delete).

## Non-goals
- Changing countdown semantics, URL param names, or adding new params.
- Introducing auth/multi-user beyond slug passwords and admin secret.
- Replacing the existing Tailwind + shadcn primitives.

## API / Data Model
- Source of truth: canonical URL params (`time`; `date` accepted on load). Themes/colors resolved via `resolveThemeTokens`; `image` as `provider:id`.
- Form model mirrors params plus publish metadata (slug, password, TTL display) and image search state (pagination cursors).
- Routing: `/v/:slug` renders viewer; `/v/:slug/edit` or `?edit=1` shows editor; viewer/editor share components.
- Share action: copy canonical URL; publish panel returns short URL `/v/:slug`.

## Invariants
- Countdown rendering logic and state machine (helper → countdown → complete) shared between preview and viewer.
- URL params remain the contract; publish stores canonical params; query overrides still work.
- Color/theme inference is shared; images resolve via provider APIs, not local emojis.

## Failure Modes
- Invalid or empty `time`/`date`: helper state blocks publish; inline errors shown.
- Image search errors or missing keys: show inline errors, keep manual input.
- Unparseable colors/themes: fall back to defaults; warn user.
- Clipboard/publish errors: show toast/status; keep form state intact.

## Observability
- Log validation errors in dev; surface inline error text in UI.
- Optional lightweight counters for share clicks and validation failures (feature-flagged).
- Console warnings when color inference falls back or emoji fetch fails (dev-only).

## Test Plan
- Unit: form validation (time parsing, color handling), URL serialization/deserialization, preview props mapping.
- Integration (React Testing Library): editing each field updates preview; share button copies expected URL; invalid inputs block submission.
- E2E (Cypress): visit `/edit`, fill all fields, preview updates, copy link opens countdown with identical params; mobile viewport sanity check.
- Lint/typecheck/build: `pnpm lint`, `pnpm typecheck`, `pnpm build`.

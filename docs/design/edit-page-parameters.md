# Countdown Parameter Editor

## Current State
- Single-page countdown reads configuration solely from URL query params (`time`/`date`, `title`, `description`, `footer`, `complete`, `image`, `bgcolor`, `color`) and renders helper/countdown/complete states.
- No dedicated UI to edit parameters beyond the “add a countdown time” helper; users must hand-edit query strings.
- Instructions page documents parameters but is static (markdown → Handlebars → static HTML).
- Data model already in place via `parseParams` and color inference; emoji assets served from `/emojis/{name}.svg`.
- Tests: Cypress covers helper/countdown/complete visibility and color inference; unit tests cover countdown flows and metadata updates.

## Goals
- Provide an edit page that can create/update all documented parameters via a form (time/date, title, description, footer, complete text, colors, image/emoji) and a live preview.
- Show a live preview of the countdown using the current form values (same rendering logic as the main page).
- Make it easy to view/copy/share the generated URL with the selected parameters.
- Keep behavior consistent with existing query-param contract (no breaking changes to read-only consumers).
- view a preview of the changes in an iframe that updates as parameters update, it's handled in a responsive layout that works well for mobile and desktop
- Use friendly components to edit (date time picker, color picker, etc)

## Non-goals
- Changing countdown semantics, URL param names, or adding new params.
- Adding authentication, persistence to a backend, or multi-user collaboration.
- Building a full design system beyond existing Tailwind + shadcn primitives.

## API / Data Model
- Source of truth: URL query params (canonical `time`; accept `date` on load but emit `time`).
- Form model mirrors params:
  - `time` (ISO UTC string), `title`, `description`, `footer`, `complete`, `image`, `bgcolor`, `color`.
  - Derived: inferred colors when one is missing (reuse `deriveColors`), validation state (time validity, color parse warnings).
- Routing: `/edit` (or `?edit=1`) renders the editor; preview uses same component tree as the main countdown, fed by the form state (no navigation required).
- Share action: generate a URL with serialized params (respect base `/countdown/`) and copy to clipboard.

## Invariants
- Countdown rendering logic and state machine (helper → countdown → complete) remain unchanged for the preview and final URL.
- Query parameters stay the only contract for the viewer page; editor writes the same params the viewer reads.
- Color inference and emoji asset paths stay compatible (`/emojis/{name}.svg`).
- Base path `/countdown/` and `docs/` build output remain unchanged.

## Failure Modes
- Invalid or empty `time`/`date`: block “Share/Preview” and surface inline error; keep existing values intact.
- Unknown emoji names or missing assets: show a placeholder and a warning, but keep the param.
- Unparseable colors: fall back to default palette and show a warning badge; avoid generating Tailwind classnames from user input.
- Clipboard failure (permissions/HTTP): show a toast with fallback instructions (manual copy).
- Mobile viewport crowding: ensure form groups and preview remain readable and inputs are usable.

## Observability
- Log validation errors in dev; surface inline error text in UI.
- Optional lightweight counters for share clicks and validation failures (feature-flagged).
- Console warnings when color inference falls back or emoji fetch fails (dev-only).

## Test Plan
- Unit: form validation (time parsing, color handling), URL serialization/deserialization, preview props mapping.
- Integration (React Testing Library): editing each field updates preview; share button copies expected URL; invalid inputs block submission.
- E2E (Cypress): visit `/edit`, fill all fields, preview updates, copy link opens countdown with identical params; mobile viewport sanity check.
- Lint/typecheck/build: `pnpm lint`, `pnpm typecheck`, `pnpm build`.

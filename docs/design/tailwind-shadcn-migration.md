# Tailwind + shadcn/ui Migration

## Context
- Current app uses Tailwind + shadcn/ui; Bootstrap removed. Base path `/` (Vite), Netlify functions for backend.
- UI components live under `src/components/ui/`, styling via `src/style.css` + Tailwind config; instructions page updated to Tailwind.

## Goals
- Maintain Tailwind + shadcn foundation; keep query-param API, publish/report flows, and theme tokens intact.
- Keep instructions page and SPA styling consistent; avoid reintroducing Bootstrap/CDN deps.

## Non-goals
- Changing countdown semantics, URL parameter names, or emoji generation behavior.
- Adding a design system beyond Tailwind + shadcn/ui (no bespoke token pipeline or theming engine).
- Introducing server-side rendering or backend telemetry.

## API / Data Model
- Query parameters (read on load; not mutated elsewhere):
  - `time` (ISO UTC) or `date` alias; determine target timestamp.
  - Optional `title`, `description`, `footer`, `complete` (complete-state text), `image` (emoji name), `bgcolor`, `color`.
- Derived data:
  - `deriveColors` infers missing text/background colors and applies them to `document.body`.
  - UI state: `helper` (invalid/missing time), `countdown` (future timestamp), `complete` (past timestamp).
  - Display text: formatted countdown string, localized date/time zone, document title set per state.
- Instructions surface: static HTML built from markdown + Handlebars template that documents the same parameters and lists emojis.

- Approach (completed): Tailwind/postcss configured; shadcn primitives in `src/components/ui`. Bootstrap removed from `index.html`; styles centralized in Tailwind layers. Instructions page uses Tailwind utilities.
- Assets/build: base `/`; image handling uses provider search (no emoji middleware), Tailwind classes are static/safe-listed via config.

## Invariants
- Query params remain the contract; publish/report/admin flows unchanged.
- Body colors/theme tokens applied via CSS vars; view-state logic intact.
- Base path `/`; Netlify functions handle backend routes; image uses provider search (no local emoji path).

## Failure Modes
- Invalid or missing `time`/`date` keeps the helper visible; need clear inline error styling without Bootstrap alerts.
- Unrecognized color names fall back to default palette; Tailwind should not assume class-generated colors for user-supplied values.
- Purging could strip dynamic Tailwind classes if any are constructed; prefer static classnames or safelist where unavoidable.
- CDN removal means local bundling must cover fonts/icons; ensure no remaining CDN dependencies break offline builds.
- Instructions page behavior (tables/accordion, if reintroduced) could break without JS; prefer CSS-only expansion or a minimal script.

## Observability
- Keep lightweight client-side logging for parse errors and color-derivation fallbacks (console in dev, optional hook for analytics if added later).
- Add a simple health indicator in dev (e.g., Vite banner) to confirm Tailwind compiled and shadcn styles loaded.
- Optionally gate a future metrics hook behind an environment flag for page impressions and helper-error counts; out of scope for now but leave seams (single logger module).

## Test Plan
- Update Cypress specs to assert visibility/text with the Tailwind layout (IDs remain stable); add checks that colors are applied inline after Bootstrap removal.
- Add a Cypress flow for the instructions page to ensure parameters/emojis render without Bootstrap dependencies.
- Manual visual pass across helper/countdown/complete states on desktop + mobile viewports; verify emoji sizing and navigation links.
- Lint/build verification: `pnpm lint`, `pnpm build`, `pnpm preview` to confirm Tailwind integration works with `base=/countdown/`.
- Optional: snapshot tests for `deriveColors` and countdown formatting to guard against regressions while refactoring JSX structure.

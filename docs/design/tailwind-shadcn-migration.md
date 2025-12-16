# Tailwind + shadcn/ui Migration

## Context
- React 18 + Vite build to `docs/` (base `/countdown/` for GitHub Pages).
- Countdown UI lives in `src/App.tsx` with Bootstrap classes from CDN (`index.html`); `src/style.css` tweaks Bootstrap tokens/layout.
- Cypress e2e (`cypress/e2e/required-params.cy.js`) asserts high-level behavior (helper vs countdown vs complete) and background/text color inference but not styling classes.
- No Tailwind/PostCSS setup, no component abstraction; all markup is Bootstrap-flavored JSX/HTML.

## Goals
- Remove Bootstrap (CSS/JS/CDN) from the countdown app and the generated instructions page.
- Introduce Tailwind CSS (with Preflight) and shadcn/ui primitives for consistent, accessible styling.
- Preserve existing query-parameter API and countdown behavior (helper -> countdown -> complete states, color inference, emoji images).
- Keep the Vite build footprint and GitHub Pages deployment flow unchanged (output still to `docs/`, base `/countdown/`).
- Clarify a component/layout foundation to simplify future UI tweaks without Bootstrap utilities.

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

## Approach
- Tooling setup: add `tailwindcss`, `postcss`, `autoprefixer`; create Tailwind config and PostCSS config; wire Tailwind entry CSS into Vite; ensure `base` handling stays `/countdown/`.
- Component layer: scaffold shadcn/ui primitives needed to replace Bootstrap usage (Button, Input, Card, Alert, Nav/Link, Layout shell). Prefer colocated `components/ui/*` with Tailwind class-based styling; add any shared layout wrappers (e.g., `PageShell`, `Header`).
- App rewrite: replace Bootstrap classnames in `src/App.tsx`/`src/main.tsx` with Tailwind/shadcn equivalents; remove reliance on Bootstrap utilities; keep existing IDs and semantic structure that tests depend on.
- Styles cleanup: drop Bootstrap CDN link from `index.html`; retire Bootstrap-specific rules from `src/style.css` after Tailwind equivalents exist; add global Tailwind layers and any custom CSS for body colors/emoji sizing that depend on runtime values.
- Instructions page: update `src/template.html` to Tailwind (remove Bootstrap/jQuery); add a small script or use progressive disclosure without Bootstrap JS; ensure markdown table stays responsive via Tailwind classes; keep emoji path rewriting intact.
- Assets/build: confirm emoji middleware in `vite.config.ts` still serves SVGs; ensure PurgeCSS safelist covers any dynamic classes (or prefer inline styles for user-provided colors).

## Invariants
- Query params remain the sole source of countdown configuration; `time`/`date` parsing rules and validation stay unchanged.
- Body background/text colors continue to reflect derived colors; contrast inference stays functional when only one color is provided.
- View-state logic (helper vs countdown vs complete) and document title updates remain intact.
- GitHub Pages base path `/countdown/` and `docs/` output directory remain unchanged.
- Emoji assets stay loadable from `/emojis/{name}.svg` via the existing middleware and build output.

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

## Feature: Vite + TypeScript React single-page app (no routes)

### Exact behavior
- Replace the current vanilla JS/static countdown page with a single-entry React app written in TypeScript, built and served by Vite (no React Router or multi-route setup).
- Preserve existing query-driven behavior: `time` (or `date` alias) controls the countdown target; optional `title`, `description`, `footer`, `bgcolor`, `color`, `image`, and `complete` still apply; keep the automatic contrast fallback when only one color is provided.
- Implement these UX states via React components:
  - Form-based UI to when `time`/`date` is missing or invalid, alongside with the option to edit any other parameters
  - Live countdown when the target is in the future
  - Complete message when the target is in the past
  - Continue updating the document title with the remaining time.
- Vite build outputs static assets ready for GitHub Pages (respecting the repo subpath); dev server script replaces `http-server` for local work; preview script serves the production build.
- Keep the instructions link pointing to the existing static instructions page; no client-side routing or history rewrites in the React app.

### UI notes
- Match the current layout and Bootstrap styling for header, countdown, helper form, description/footer, and emoji image placement.
- Use a single React root (e.g., `#root`) without in-app navigation; links to GitHub and instructions remain normal anchor navigations.
- Maintain responsiveness and color theming parity with the current page (including inferred text/background colors).

### Edge cases
- Ensure Vite `base`/asset handling works when hosted under the GitHub Pages subpath so emoji SVGs and icons load correctly.
- Honor both `time` and `date` params, preferring `time`; invalid or missing values show the helper, past values show the completed view.
- Keep URL rebuilding behavior from the helper: preserve other query params, strip `date` when `time` is set, and avoid reloading loops.
- If only `bgcolor` or only `color` is provided, continue deriving the missing counterpart for legible contrast.
- Preserve current behavior when no image is provided (hide image container) and when the timer reaches zero (stop updates, show complete text).

### Test plan
- `npm run test:e2e`. Ensure tests for the following scenarios exist or create them:
  - Open `/` with no params → form view with existing parameter values set, countdown hidden.
  - Open `/?time=2030-01-01T00:00:00Z&title=Hi` → countdown renders, title shows, form view hidden.
  - Open `/?date=2030-01-01T00:00:00Z` → treated as valid alias; helper stays hidden.
  - Open `/?bgcolor=000&image=1F389` → background/text colors stay legible via contrast inference; image loads.

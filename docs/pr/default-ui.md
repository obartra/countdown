## Feature: required-parameter helper on countdown page

### Exact behavior
- On `docs/index.html`, when `time` (or `date` alias) is missing or invalid, hide the live countdown UI and show a helper page instead.
- Helper UI explains the required `time` query param (ISO UTC, e.g., `2025-01-01T00:00:00Z`), offers a date/time input to enter/adjust it, and a quick-fill button for “24 hours from now”. It also exposes ways to edit all other parameters.
- Clicking a submit button (once required fields are set) rebuilds the URL (preserving any other query params like `title`, `color`, `bgcolor`, `image`) and reloads to show the countdown.
- A preview button shows the rendered preview in an iframe on a dismissable bootstrap panel that takes full width on mobile.

### UI notes
- Use full page for the helper UI, match existing Bootstrap styling.
- Keep the helper unobtrusive: only render when required params are missing or invalid; otherwise show the normal countdown.
- Provide clear inline validation message if the entered time is unparsable. Always try to parse and understand the date when unambiguous
- Buttons: “Set to 24h from now” (prefills input), "Preview countdown" (shows iframe panel with preview using the params) “Start countdown” (applies the param).

### Edge cases
- If both `time` and `date` exist, prefer `time`; show helper only when neither is valid.
- If time is in the past, continue showing the “time’s up” view
- Preserve other query params when rebuilding the URL.
- Ensure no flicker: determine validity before rendering countdown/complete states.

### Test plan
- `npm run build` (sanity).
- `npm start`; visit `http://localhost:8080/` with no params → helper panel visible, countdown hidden.
- Enter a valid ISO time → page reloads with `?time=...`, countdown shows, helper hidden.
- Click “24 hours from now” then submit → countdown appears with the generated time.
- Visit `/?time=2030-01-01T00:00:00Z&title=Hi` → no helper, countdown shows with title preserved.
- Visit `/?date=2030-01-01T00:00:00Z` → treated as valid (no helper) if alias supported; if invalid format, helper shows.

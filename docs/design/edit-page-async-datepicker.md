# Async Editor + Friendly Date Picker (proposal)

## Summary
We want the edit experience to be much friendlier—especially the date/time input—while avoiding a bundle cost hit for users who already have valid countdown URLs. The likely solution: lazy-load the editor (and any date picker library) only when required parameters are missing or when the user explicitly wants to edit, and swap the current `datetime-local` control for a popular, ergonomic picker that still emits a precise UTC timestamp. The goal is to improve UX without regressing load time for the default countdown view.

## Current State (evidence)
- Routing: `src/main.tsx` preloads both `App` and `EditPage` and chooses which to render based on param validity (`state === "helper"` from `deriveCountdownMeta`). No dynamic import today.
- Editor: `src/EditPage.tsx` uses a native `datetime-local` input plus inline UTC/local conversion, syncs query params via `history.replaceState`, and renders a live preview of the countdown. All logic lives in the main bundle.
- Countdown logic: shared in `src/countdown.ts` (param parsing, color inference, countdown formatting/state).
- Styling: Tailwind + shadcn primitives; no external date picker library in dependencies.
- Tests: Cypress and RTL target main countdown behaviors; no coverage for lazy loading or third-party date picker interactions.
- Build/deploy: Vite SPA, output to `docs/` with base `/countdown/`, no code splitting targeted for editor today.

## Intent / Problem
- Improve the date/time UX beyond native `datetime-local` (timezone clarity, presets, mobile friendliness).
- Avoid penalizing default countdown load time with heavy date picker dependencies or editor UI when the URL is already valid.

## Proposed Direction (default)
- **Lazy-load the editor**: Convert the editor to a dynamic import via `React.lazy`/`Suspense`, loaded only when `deriveCountdownMeta` says the required params are missing or when an explicit “Edit” action is taken.
- **Adopt a popular date picker**: Use a small, well-supported React date/time picker (e.g., `react-datepicker` or `@headlessui` + `react-day-picker`) that supports time selection, keyboard input, and clear UTC/local conversion. Keep the control isolated to the editor chunk.
- **UTC handling**: Keep the existing conversion pipeline—editor captures local time, shows both local and computed UTC, and writes ISO UTC to the query params.
- **Bundle impact**: Ensure the picker and editor live in a separate chunk; default countdown path continues to load only the viewer bundle.

## Alternatives (brief)
- **Keep native input, add presets**: Simpler UX tweaks (preset buttons, better messaging) without third-party deps; lower bundle impact but less polished picker experience.
- **Build a custom lightweight picker**: Tailored UX, but higher effort and maintenance; risk of regressions vs. battle-tested libraries.

## Risks / Unknowns
- Picker bundle size could still be noticeable; need to measure chunk sizes and confirm editor-only loading.
- Accessibility and mobile UX vary across libraries; must vet keyboard/screen reader support.
- Timezone clarity: must ensure displayed/localized values match the ISO UTC output to avoid user confusion.
- Testing complexity: need stable selectors/mocks for picker interactions in RTL/Cypress.
- SSR is not used, but Vite dev/preview must support lazy-loading chunks without base-path issues (`/countdown/`).

## Open Questions
- Which picker library do we prefer (react-datepicker, react-day-picker, something else)? Priority: accessibility, small footprint, time selection support.
- Do we need predefined presets (e.g., “+1h”, “Tomorrow 9am”) in addition to the picker?
- Should the editor be user-triggered even when params are valid (e.g., via an “Edit” button) or only auto-shown when invalid?
- Is clipboard/share still required in the editor, or should it move to a dedicated control?
- Any constraints on additional deps or bundle size budget?

## High-Level Implementation Plan (PR-sized steps)
1) **Split loading**: Refactor `src/main.tsx` to lazy-load `EditPage` with `React.lazy/Suspense`; keep countdown viewer eagerly loaded. Add a minimal fallback UI during editor load.
2) **Picker integration**: Add chosen date/time picker to `EditPage` in place of `datetime-local`, preserving current validation/UTC conversion and query-sync behavior. Keep picker imports scoped to the lazy chunk.
3) **UX polish**: Add inline UTC/local readout (retain existing), ensure keyboard/mouse/touch support, and consider a couple of quick presets if the picker supports it cheaply.
4) **Tests**: Add RTL tests for the new picker flow (valid/invalid dates, UTC output, query sync) and a minimal Cypress path to ensure the lazy editor renders when params are missing.
5) **Performance check**: Inspect bundle chunks to confirm editor/picker are isolated; verify main countdown bundle size/regression is minimal.
6) **Docs/notes**: Document the picker choice, lazy-loading rationale, and any known limitations for future contributors.***

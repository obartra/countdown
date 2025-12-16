# App.tsx Refactor into Smaller Components (proposal)

## Summary
App.tsx has grown to own routing decisions (helper/countdown/complete), layout, image loading, attribution, timezone formatting, and color application. This proposal suggests splitting it into well‑named, focused components while keeping behavior and tests unchanged. Goal: improve readability and future edits without altering user‑visible behavior.

## Current State (evidence)
- Single monolithic component `src/App.tsx` handles:
  - Parsing params (via `parseParamsFromSearch`) and countdown state/meta (`deriveCountdownMeta`, `formatCountdown`, `dateFormatter`, `deriveColors`) from `src/countdown.ts`.
  - Page styling (sets `document.body` colors) and image resolution/attribution via async calls to `resolveImage`/`parseImageId` (`src/imageResolver.ts`), with dynamic sizing logic measured via refs/useLayoutEffect.
  - Conditional UI for helper, countdown grid, complete state, image/attribution, description, footer, and header nav. Uses Tailwind/shadcn primitives.
- App tests assert helper visibility, countdown formatting, image attribution, and dynamic sizing (`src/App.test.tsx`).
- The root decides viewer vs. editor based on params (`src/main.tsx`), lazy‑loading the editor.
- Styles and tokens come from Tailwind/shadcn setup (`src/style.css`, `tailwind.config.js`); external image rendering uses provider:id.

## Proposed Direction (default)
- Extract coherent subcomponents while keeping App responsible for orchestration/state and introducing a shared context:
  - Components live alongside existing primitives in `src/components/ui/` (e.g., `HeaderNav`, `HelperForm`, `CountdownGrid`, `CompleteBanner`, `ImageDisplay`, `DescriptionSection`, `FooterSection`).
  - Add a lightweight context (e.g., `CountdownContext`) to provide derived params/meta and shared callbacks instead of deep prop drilling.
  - Factor the image max-height measurement into a dedicated hook (e.g., `useImageMaxHeight`) reused by the image display component.
- Shared utilities stay in `src/countdown.ts` and `src/imageResolver.ts`; presentation moves into the extracted components.
- Tests are the guardrail: DOM/ID/class changes are acceptable so long as all existing tests continue to pass.

## Alternatives
- Minimal extraction (only image + countdown grid) leaving header/helper inline (less churn, smaller win).
- Heavier state split with context providers (more churn, harder to ensure parity).

## Risks / Unknowns
- Test fragility: IDs/structure changes could break RTL/Cypress assertions.
- Prop/threading errors if state is split improperly (e.g., image sizing refs).
- Dynamic layout measurement may need to stay in the top component; moving it could complicate ref reuse.
- External image resolution still async; need to avoid double fetches on refactor.

## Open Questions
- Any naming preferences for the new context/provider and hook files? **Answer:** Match existing conventions (camelCase filenames, concise/one-word where practical).
- Should we add modest component-level tests for the new pieces (beyond existing App tests)? **Answer:** Yes—add light component tests alongside existing App coverage.

## High-Level Implementation Plan (PR-sized steps)
1) **Structure & hooks**: Introduce a `useCountdownViewModel` (params, state, derived values) and a `useImageMaxHeight` hook that encapsulates the measurement logic. Keep behavior parity.
2) **Context**: Add a `CountdownContext` (provider + hook) to supply derived params/meta/state to children and remove deep prop drilling.
3) **Component extraction**: Create presentational components in `src/components/ui/` for header/nav, helper form, countdown grid, image display (with attribution + sizing props), description, and footer. Lift only rendering; keep orchestration in App + context.
4) **Wire & preserve contracts**: Replace inline JSX with the new components, passing data via context/props. Helper/countdown/complete visibility and image resolution flow must remain identical; DOM/ID changes are acceptable as long as tests pass.
5) **Verification**: Add light component-level tests for new pieces where helpful; update/confirm RTL tests if selectors change; rerun `pnpm test` and targeted Cypress specs to ensure parity.

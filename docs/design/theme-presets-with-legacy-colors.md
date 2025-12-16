# Theme Presets + Legacy Color Params (proposal)

## Summary
Introduce a curated set of background/text color themes (“different vibes”) and make theme selection the primary UX in the editor. Keep the existing `bgcolor`/`color` URL parameters for compatibility, but the editor defaults to themes and applies both colors from the chosen theme. If a URL arrives with custom colors, showing a “Custom” state (non-selectable) would be nice; falling back to the default theme selection is acceptable. Docs should highlight themes as the recommended path while noting that color params still work.

## Current State (evidence)
- URL parsing: `parseParamsFromSearch` in `src/countdown.ts` reads `bgcolor` and `color`, then `deriveColors` infers missing values for contrast and provides `backgroundColor`/`textColor` (`src/countdown.ts`).
- Viewer application: `src/App.tsx` applies derived colors to `document.body` and renders countdown/helper/complete states using those colors.
- Editor UX: `src/EditPage.tsx` exposes freeform text inputs for `bgcolor`/`color`, derives colors live, syncs query params via `history.replaceState`, and shows a preview.
- Docs: README and instructions page list `bgcolor`/`color` as parameters (`README.md`, `src/template.html` used to generate the instructions page).
- Architecture/tooling: Vite SPA with lazy-loaded editor (`src/main.tsx`), Tailwind/shadcn UI components, shareable URLs are the contract.

## Proposed Direction (default)
- Add a curated theme catalog (name + background/text colors) with up to ~20 options spanning dark/light, neon, pastel, autumn, summery, 80s/90s vibes. All themes should meet at least WCAG AA contrast.
- The editor’s primary control becomes a theme selector; choosing a theme sets both colors in the form and preview. Manual color inputs are removed from the editor.
- Keep `bgcolor`/`color` params functional in parsing and rendering. However, the editor does not need to map arbitrary incoming colors back to a theme; showing the default theme selection while honoring parsed colors in the preview is acceptable.
- Prefer to surface a non-selectable “Custom” state in the selector when parsed colors don’t match a known theme; if that’s too heavy, default theme selection is acceptable.
- URL output from the editor should continue to emit explicit `bgcolor`/`color` values taken from the selected theme (no new `theme` param needed). Theme catalog may include an accent, but buttons/links today use only text/background.
- Update docs to recommend themes as the default approach, while noting that manual colors remain possible via URL params (advanced/legacy).

## Alternatives
- Add a `theme` param and deprecate `bgcolor`/`color` (cleaner contract but bigger break).
- Keep only freeform colors and just add a “recommended palettes” section (lighter change, less opinionated).
- Map incoming colors to the closest theme to reflect selection state (extra complexity and guessy).

## Risks / Unknowns
- Theme quality: need accessible, distinct palettes across the requested vibe set; all should hit WCAG AA contrast.
- Editor state: showing a default theme while rendering custom URL colors may confuse users; a “Custom” indicator helps if feasible.
- Bundle/UX: theme catalog is small, but the selector UX (cards/buttons) must fit the existing layout.
- Consistency: ensuring both viewer and editor derive colors from the same source of truth to avoid mismatches.

## Open Questions
- Do we cap the theme list at ~20, or should we start smaller and expand? Any must-have names to reserve?
- Should we expose theme accent colors now (even if not used) for future-proofing, or keep only background/text to minimize scope?
- How to detect “Custom”: exact match only, or allow tolerance (e.g., case-insensitive hex/#)?
- Do we want any user-facing messaging when a legacy URL uses colors that don’t match a theme (e.g., “Using custom colors”)?
- How should themes be ordered or grouped (by vibe vs. by accessibility/contrast)?

## High-Level Implementation Plan (PR-sized steps)
1) Theme catalog: define up to ~20 theme objects (name, background, text, optional accent) spanning the requested vibes; verify AA contrast.
2) Parsing/source of truth: adjust `parseParamsFromSearch`/`deriveColors` to resolve theme defaults, detect custom colors, and still honor explicit URL color params for rendering. Keep viewer rendering unchanged.
3) Editor UI: add a theme selector (cards/buttons) that sets colors; remove manual color inputs; show “Custom” state when parsed colors don’t map cleanly. Preserve URL syncing with explicit colors from the selected theme or parsed overrides.
4) Docs: update README and instructions template to present themes as primary, note legacy `bgcolor`/`color`, and list available themes (with contrast note).
5) Tests: extend RTL/Cypress for theme selection, custom detection, URL emission with theme colors, and rendering of custom URL colors with a “Custom” indicator/default fallback.
6) Polish: ensure viewer/editor share the same color source of truth; validate contrast and layout for the selector; consider future accent support without breaking URLs.***

## Theme Catalog (draft, AA-checked for normal text)
All themes below use background/text pairs that meet or exceed WCAG AA contrast for normal text. Accent is optional and unused today but included for future buttons/links.

| Key | Vibe | Background | Text | Accent (optional) |
| --- | ---- | ---------- | ---- | ----------------- |
| midnight | dark | #0B1021 | #F2F5FF | #7DD3FC |
| aurora-neon | neon | #050608 | #B5FF73 | #5CF4FF |
| synthwave | 80s | #1A0F2E | #F8E7FF | #FF5CAA |
| noir | high-contrast | #0C0C0C | #FFFFFF | #FFC857 |
| dawn-pastel | light/pastel | #FFF4E6 | #1C1A24 | #FF8C42 |
| seaside | summery/cool | #E2F3FF | #0F1C2E | #1FB6FF |
| forest-dusk | autumn/nature | #1E2B1F | #E8F5E9 | #F6C177 |
| desert-sunset | warm | #2B1A0E | #FDE7C5 | #F59E0B |
| glacier | cool/dark | #0E1726 | #E9F4FF | #7DD3FC |
| paper | minimal/light | #FFFFFF | #1F2937 | #2563EB |
| latte | warm light | #F7EFE8 | #2C1810 | #D97757 |
| moss | soft nature | #EEF6EB | #1C2B1D | #6FBF73 |
| candy | pastel | #FDF1FA | #312033 | #E75480 |
| cyber-lime | high-contrast/neon | #101418 | #D7FF6B | #76E4F7 |
| deep-ocean | dark/cool | #0B1724 | #E5F2FF | #64D2FF |
| berry-night | 90s/dark | #2B0B3F | #F6E1FF | #7C3AED |
| sandbar | summery/light | #FFF8E1 | #1E1B1A | #F59E0B |
| slate | neutral/dark | #111827 | #E5E7EB | #38BDF8 |

Notes:
- Names are URL-safe; we can add aliases later if needed.
- If a parsed `bgcolor`/`color` pair does not match any theme exactly, treat it as “Custom” but still render the parsed colors.
- Re-validate contrast with automated tooling during implementation; adjust hexes if any fall short for specific text sizes.***

## Parsing & Source of Truth (detailed plan)
Goal: keep viewer behavior unchanged while introducing themes as the editor’s primary source of colors. URLs remain the contract via `bgcolor`/`color`; theme selection writes explicit colors to the URL.

Rules for `parseParamsFromSearch` / `deriveColors`:
- Default baseline: if neither `bgcolor` nor `color` is present, use the default theme colors (pick one from the catalog, e.g., `midnight`).
- Explicit params win: if `bgcolor` and/or `color` are present, use them directly for rendering (no inference from a theme). Preserve existing contrast inference when only one color is provided.
- Theme detection: compare the resolved background/text pair against the catalog (normalize hex casing and `#` prefix). If it matches exactly, attach the theme key; otherwise mark as `Custom`.
- Custom handling: when marked `Custom`, render the provided colors but show the editor selector in the “Custom” state (non-selectable).
- Editor output: selecting a theme writes both `bgcolor` and `color` from that theme into the URL (no new `theme` param). “Custom” only occurs when parsing a URL that doesn’t match a known theme.
- Source of truth: keep one utility (e.g., `resolveColors`) used by both viewer and editor to avoid drift; viewer continues to consume `backgroundColor`/`textColor` exactly as today.

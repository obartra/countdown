# Theme Presets + Legacy Color Params

## Summary
Implemented: curated theme catalog (background/surface/text/textSecondary/accent) in `src/themes.ts`, theme selector in the editor, legacy `bgcolor`/`color` params still supported. Custom colors render and show as “Custom”.

## Current State (evidence)
- Colors/themes resolved via `resolveThemeTokens` and `createThemeCssVars`; defaults from `DEFAULT_THEME_KEY = midnight`.  
- Theme catalog (`src/themes.ts`) includes surface/textSecondary and accent tokens; CSS vars applied app-wide.  
- Editor (`src/EditPage.tsx`) uses a theme selector, keeps manual color inputs for custom overrides, and canonicalizes colors via `buildCanonicalCountdownSearchParams`.  
- Viewer (`src/App.tsx`, `src/hooks/useCountdownViewModel.ts`) applies theme tokens to body + layout.  
- README/template document `bgcolor`/`color` plus themes; custom colors supported.

## Proposed Direction (default)
- Keep the current theme catalog and selector as primary UX; retain legacy color params and “Custom” state when colors don’t match a theme.
- Continue emitting explicit `bgcolor`/`color` (no `theme` param) and applying theme tokens globally (background/surface/text/textSecondary/accent).
- Maintain AA contrast checks for theme updates; document themes in README/template.

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

| Key | Vibe | Background | Surface | Text | Text Secondary | Accent (optional) |
| --- | ---- | ---------- | ------- | ---- | -------------- | ----------------- |
| midnight | dark | #0B1021 | #0F172A | #F2F5FF | #96A0BA | #7DD3FC |
| aurora-neon | neon | #050608 | #131A11 | #B5FF73 | #648C42 | #5CF4FF |
| synthwave | 80s | #1A0F2E | #2C203F | #F8E7FF | #9587A2 | #FF5CAA |
| noir | high-contrast | #0C0C0C | #1F1F1F | #FFFFFF | #878787 | #FFC857 |
| dawn-pastel | light/pastel | #FFF4E6 | #F1E7DA | #1C1A24 | #6D6769 | #FF8C42 |
| seaside | summery/cool | #E2F3FF | #D5E6F2 | #0F1C2E | #596777 | #1FB6FF |
| forest-dusk | autumn/nature | #1E2B1F | #2E3B2F | #E8F5E9 | #97A498 | #F6C177 |
| desert-sunset | warm | #2B1A0E | #3C2A1D | #FDE7C5 | #A69279 | #F59E0B |
| glacier | cool/dark | #0E1726 | #202937 | #E9F4FF | #86919D | #7DD3FC |
| paper | minimal/light | #FFFFFF | #F2F2F3 | #1F2937 | #686F78 | #2563EB |
| latte | warm light | #F7EFE8 | #EBE2DB | #2C1810 | #72625B | #D97757 |
| moss | soft nature | #EEF6EB | #E1EADF | #1C2B1D | #5E6B5E | #6FBF73 |
| candy | pastel | #FDF1FA | #F1E4EE | #312033 | #726373 | #E75480 |
| cyber-lime | high-contrast/neon | #101418 | #20271F | #D7FF6B | #7C9445 | #76E4F7 |
| deep-ocean | dark/cool | #0B1724 | #1C2936 | #E5F2FF | #84919E | #64D2FF |
| berry-night | 90s/dark | #2B0B3F | #3B1C4E | #F6E1FF | #A187AE | #7C3AED |
| sandbar | summery/light | #FFF8E1 | #F2EBD5 | #1E1B1A | #6E6961 | #F59E0B |
| slate | neutral/dark | #111827 | #222937 | #E5E7EB | #8C9099 | #38BDF8 |

Notes:
- Names are URL-safe; we can add aliases later if needed.
- If a parsed `bgcolor`/`color` pair does not match any theme exactly, treat it as “Custom” but still render the parsed colors.
- `surface` + `textSecondary` are picked to keep WCAG AA contrast for normal text against both `background` and `surface` (primary + secondary text).
- Re-validate contrast with automated tooling during implementation; adjust hexes if any fall short for specific text sizes.***

## Theme Token Upgrade (secondary text + surface)
Today the app effectively has a single “foreground” color driven by `color`/derived text color, while shadcn card/footer styling uses static CSS variables (`--card`, `--muted`, etc.). As we lean more into curated themes, we should make each theme describe a small set of **semantic tokens** so we can style the whole UI consistently without fighting the base shadcn palette.

Proposed additional per-theme tokens:
- `textSecondary`: used for labels, helper copy, and metadata (“muted” text)
- `surface`: used for card backgrounds and footer background (a subtle step above the page background)

### Proposed values for the default theme (`midnight`)
These are chosen to preserve the existing vibe (deep navy + cool whites), while adding a calmer secondary tone and a surface color that still reads as “midnight” (not neutral gray).

| Token | Value | Usage |
| --- | --- | --- |
| `background` | `#0B1021` | Page background |
| `surface` | `#0F172A` | Cards + footer background |
| `text` | `#F2F5FF` | Primary text |
| `textSecondary` | `#96A0BA` | Secondary / muted text |
| `accent` | `#7DD3FC` | Links, focus rings, primary button |

Contrast checks (WCAG AA target: ≥4.5:1 for normal text):
- `text` on `background`: 17.36:1
- `textSecondary` on `background`: 7.24:1
- `text` on `surface`: 16.39:1
- `textSecondary` on `surface`: 6.83:1

Notes:
- `surface` is intentionally close to `background` (low contrast between surfaces) so the UI stays “flat/dark” while still giving cards/footers a distinct layer.
- For other themes, we can either hand-pick `surface`/`textSecondary` or derive them (blend/shade) and then adjust until both text colors meet AA on both backgrounds.

## Parsing & Source of Truth (detailed plan)
Goal: keep viewer behavior unchanged while introducing themes as the editor’s primary source of colors. URLs remain the contract via `bgcolor`/`color`; theme selection writes explicit colors to the URL.

Rules for `parseParamsFromSearch` / `deriveColors`:
- Default baseline: if neither `bgcolor` nor `color` is present, use the default theme colors (pick one from the catalog, e.g., `midnight`).
- Explicit params win: if `bgcolor` and/or `color` are present, use them directly for rendering (no inference from a theme). Preserve existing contrast inference when only one color is provided.
- Theme detection: compare the resolved background/text pair against the catalog (normalize hex casing and `#` prefix). If it matches exactly, attach the theme key; otherwise mark as `Custom`.
- Custom handling: when marked `Custom`, render the provided colors but show the editor selector in the “Custom” state (non-selectable).
- Editor output: selecting a theme writes both `bgcolor` and `color` from that theme into the URL (no new `theme` param). “Custom” only occurs when parsing a URL that doesn’t match a known theme.
- Source of truth: keep one utility (e.g., `resolveColors`) used by both viewer and editor to avoid drift; viewer continues to consume `backgroundColor`/`textColor` exactly as today.

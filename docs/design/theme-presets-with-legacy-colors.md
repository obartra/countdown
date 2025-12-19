# Theme Presets + Legacy Color Params

## Summary
Implemented: Radix-derived theme catalog (background/surface/text/textSecondary/accent) in `src/themes.ts`, theme selector in the editor, legacy `bgcolor`/`color` params still supported. Custom colors render and show as "Custom".

## Current State (evidence)
- Colors/themes resolved via `resolveThemeTokens` and `createThemeCssVars`; defaults from `DEFAULT_THEME_KEY = graphite`.  
- Theme catalog (`src/themes.ts`) includes surface/textSecondary and accent tokens; CSS vars applied app-wide.  
- Editor (`src/EditPage.tsx`) uses a theme selector, keeps manual color inputs for custom overrides, and canonicalizes colors via `buildCanonicalCountdownSearchParams`.  
- Viewer (`src/App.tsx`, `src/hooks/useCountdownViewModel.ts`) applies theme tokens to body + layout.  
- README/template document `bgcolor`/`color` plus themes; custom colors supported.

## Proposed Direction (default)
- Use the Radix-derived theme catalog (12 dark + 12 light) as primary UX; retain legacy color params and "Custom" state when colors do not match a theme.
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
- Theme list size is set to 24 (12 dark + 12 light) to fill the grid; revisit if we need fewer or more options.
- Should we expose theme accent colors now (even if not used) for future-proofing, or keep only background/text to minimize scope?
- How to detect “Custom”: exact match only, or allow tolerance (e.g., case-insensitive hex/#)?
- Do we want any user-facing messaging when a legacy URL uses colors that don’t match a theme (e.g., “Using custom colors”)?
- How should themes be ordered or grouped (by vibe vs. by accessibility/contrast)?

## High-Level Implementation Plan (PR-sized steps)
1) Theme catalog: define 24 theme objects (12 dark + 12 light) with background/surface/text/textSecondary/accent tokens; verify AA contrast.
2) Parsing/source of truth: adjust `parseParamsFromSearch`/`deriveColors` to resolve theme defaults, detect custom colors, and still honor explicit URL color params for rendering. Keep viewer rendering unchanged.
3) Editor UI: add a theme selector (cards/buttons) that sets colors; remove manual color inputs; show “Custom” state when parsed colors don’t map cleanly. Preserve URL syncing with explicit colors from the selected theme or parsed overrides.
4) Docs: update README and instructions template to present themes as primary, note legacy `bgcolor`/`color`, and list available themes (with contrast note).
5) Tests: extend RTL/Cypress for theme selection, custom detection, URL emission with theme colors, and rendering of custom URL colors with a “Custom” indicator/default fallback.
6) Polish: ensure viewer/editor share the same color source of truth; validate contrast and layout for the selector; consider future accent support without breaking URLs.***

## Theme Catalog (draft, AA-checked for normal text)
All themes below use background/text pairs that meet or exceed WCAG AA contrast for normal text. Accent is optional and unused today but included for future buttons/links. Tokens are sourced from Radix Colors (scale steps 1/2/11/12/9).

| Key | Group | Background | Surface | Text | Text Secondary | Accent (optional) |
| --- | ----- | ---------- | ------- | ---- | -------------- | ----------------- |
| graphite | dark | #111113 | #18191B | #EDEEF0 | #B0B4BA | #696E77 |
| charcoal | dark | #111111 | #191919 | #EEEEEE | #B4B4B4 | #6E6E6E |
| cinder | dark | #111110 | #191918 | #EEEEEC | #B5B3AD | #6F6D66 |
| forest | dark | #101211 | #171918 | #ECEEED | #ADB5B2 | #63706B |
| moss | dark | #111210 | #181917 | #ECEEEC | #AFB5AD | #687066 |
| ocean | dark | #0D141F | #111A27 | #C2F3FF | #75C7F0 | #7CE2FE |
| indigo | dark | #11131F | #141726 | #D6E1FF | #9EB1FF | #3E63DD |
| iris | dark | #13131E | #171625 | #E0DFFE | #B1A9FF | #5B5BD6 |
| plum | dark | #181118 | #201320 | #F4D4F4 | #E796F3 | #AB4ABA |
| ember | dark | #181111 | #1F1513 | #FBD3CB | #FF977D | #E54D2E |
| ruby | dark | #191113 | #1E1517 | #FED2E1 | #FF949D | #E54666 |
| gilded | dark | #121211 | #1B1A17 | #E8E2D9 | #CBB99F | #978365 |
| paper | light | #FCFCFD | #F9F9FB | #1C2024 | #60646C | #8B8D98 |
| cloud | light | #FCFCFC | #F9F9F9 | #202020 | #646464 | #8D8D8D |
| dune | light | #FDFDFC | #F9F9F8 | #21201C | #63635E | #8D8D86 |
| sage | light | #FBFDFC | #F7F9F8 | #1A211E | #5F6563 | #868E8B |
| olive | light | #FCFDFC | #F8FAF8 | #1D211C | #60655F | #898E87 |
| sky | light | #F9FEFF | #F1FAFD | #1D3E56 | #00749E | #7CE2FE |
| periwinkle | light | #FDFDFE | #F7F9FF | #1F2D5C | #3A5BC7 | #3E63DD |
| lilac | light | #FDFDFF | #F8F8FF | #272962 | #5753C6 | #5B5BD6 |
| orchid | light | #FEFCFF | #FDF7FD | #53195D | #953EA3 | #AB4ABA |
| coral | light | #FFFCFC | #FFF8F7 | #5C271F | #D13415 | #E54D2E |
| rose | light | #FFFCFD | #FFF7F8 | #64172B | #CA244D | #E54666 |
| honey | light | #FDFDFC | #FAF9F2 | #3B352B | #71624B | #978365 |

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

### Proposed values for the default theme (`graphite`)
These are sourced from Radix `slateDark` to provide a neutral, high-contrast baseline with minimal hue bias.

| Token | Value | Usage |
| --- | --- | --- |
| `background` | `#111113` | Page background |
| `surface` | `#18191B` | Cards + footer background |
| `text` | `#EDEEF0` | Primary text |
| `textSecondary` | `#B0B4BA` | Secondary / muted text |
| `accent` | `#696E77` | Links, focus rings, primary button |

Contrast checks (WCAG AA target: ≥4.5:1 for normal text):
- `text` on `background`: 16.25:1
- `textSecondary` on `background`: 9.06:1
- `text` on `surface`: 15.15:1
- `textSecondary` on `surface`: 8.45:1

Notes:
- `surface` is intentionally close to `background` (low contrast between surfaces) so the UI stays flat/dark while still giving cards/footers a distinct layer.
- For other themes, we can either hand-pick `surface`/`textSecondary` or derive them (blend/shade) and then adjust until both text colors meet AA on both backgrounds.

## Parsing & Source of Truth (detailed plan)
Goal: keep viewer behavior unchanged while introducing themes as the editor’s primary source of colors. URLs remain the contract via `bgcolor`/`color`; theme selection writes explicit colors to the URL.

Rules for `parseParamsFromSearch` / `deriveColors`:
- Default baseline: if neither `bgcolor` nor `color` is present, use the default theme colors (pick one from the catalog, e.g., `graphite`).
- Explicit params win: if `bgcolor` and/or `color` are present, use them directly for rendering (no inference from a theme). Preserve existing contrast inference when only one color is provided.
- Theme detection: compare the resolved background/text pair against the catalog (normalize hex casing and `#` prefix). If it matches exactly, attach the theme key; otherwise mark as `Custom`.
- Custom handling: when marked `Custom`, render the provided colors but show the editor selector in the “Custom” state (non-selectable).
- Editor output: selecting a theme writes both `bgcolor` and `color` from that theme into the URL (no new `theme` param). “Custom” only occurs when parsing a URL that doesn’t match a known theme.
- Source of truth: keep one utility (e.g., `resolveColors`) used by both viewer and editor to avoid drift; viewer continues to consume `backgroundColor`/`textColor` exactly as today.

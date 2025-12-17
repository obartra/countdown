## PR: Canonicalize countdown URLs + omit defaults

### Summary
Introduce a shared URL canonicalization layer so both viewer and editor:
- Rewrite the URL to a canonical form on load and on every edit change.
- Omit any parameters that match defaults.
- Normalize equivalent values in the URL (e.g., colors), without rewriting what the editor inputs display.

Links:
- Design proposal: `docs/design/url-defaults-canonicalization.md`

### Exact behavior (contract)
#### Canonicalization rules
- `date` is treated as an alias for `time`.
  - Canonical URLs use `time` only (drop `date` when present).
- Text params (`title`, `description`, `footer`, `image`, `complete`):
  - Trim whitespace in the URL.
  - Omit when empty after trim.
  - `complete` is omitted when it equals the default complete text.
- Color params (`bgcolor`, `color`):
  - Normalize equivalent representations in the URL (e.g., `fff`, `#fff`, `#ffffff`, `white` → canonical `#ffffff`).
  - Omit color params when they are redundant:
    - Omit both when they would render the same as having neither set (default theme pair).
    - If both are set and one is fully implied by the other (via `deriveColors`), omit the implied one.
  - Do not add new color params that were not set; only normalize/omit existing ones.
- Non-countdown query params (e.g., `edit`) are preserved.

#### When canonicalization happens
- On initial load (viewer or editor), the current URL is replaced in-place (`history.replaceState`) with its canonicalized version.
- In the editor, the URL updates on every form change (every keystroke) to the canonicalized version.

#### UI expectations
- Editor inputs do not “snap” to canonical forms (e.g., a user-entered `#fff` stays `#fff` in the input), even though the URL uses the canonical form.
- Editor preview renders from canonical params (i.e., the same params the viewer would parse).
- Default values may be shown in editor inputs even if the URL omits them (notably `complete`).

### Files to touch
- Add `src/countdownUrl.ts` (shared canonicalization + serialization helpers).
- Update `src/countdown.ts` to export default constants used by both viewer/editor (e.g., default complete text).
- Update `src/main.tsx` to canonicalize URL on initial load and parse from canonical params.
- Update `src/EditPage.tsx` to:
  - Use shared canonicalization when writing the URL and building share URLs.
  - Show default `complete` value in the input while omitting it from the URL.
  - Render preview from canonical params.
- Update tests impacted by URL changes:
  - `src/EditPage.test.tsx` (default theme selection should no longer force `bgcolor`/`color` into the URL).

### Verification
- `pnpm test`
- `pnpm lint`
- `pnpm types`


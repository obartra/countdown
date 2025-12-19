## Feature: Radix theme catalog refresh (12 dark + 12 light)

### Goals
- Replace the theme catalog with Radix Colors-derived tokens (background, surface, text, textSecondary, accent).
- Set the default theme to `graphite` (Radix `slateDark`), replacing the previous default.
- Keep legacy `bgcolor`/`color` params and the "Custom" state when colors do not match a catalog theme.
- Ensure each theme group fills the 2- and 3-column grids (12 per group).

### Exact behavior
- Theme tokens are sourced from Radix Colors scale steps:
  - background = step 1
  - surface = step 2
  - text = step 12
  - textSecondary = step 11
  - accent = step 9
- `DEFAULT_THEME_KEY` becomes `graphite`.
- `resolveThemeTokens` uses `DEFAULT_THEME_KEY` for invalid custom colors.
- Theme detection still compares resolved background/text pairs to catalog values; mismatches show as "Custom".
- Existing URLs that used prior theme colors still render those colors but will no longer map to a theme key unless they match a new catalog pair exactly.

### Theme catalog
Dark
| Key | Background | Surface | Text | Text Secondary | Accent |
| --- | ---------- | ------- | ---- | -------------- | ------ |
| graphite | #111113 | #18191B | #EDEEF0 | #B0B4BA | #696E77 |
| charcoal | #111111 | #191919 | #EEEEEE | #B4B4B4 | #6E6E6E |
| cinder | #111110 | #191918 | #EEEEEC | #B5B3AD | #6F6D66 |
| forest | #101211 | #171918 | #ECEEED | #ADB5B2 | #63706B |
| moss | #111210 | #181917 | #ECEEEC | #AFB5AD | #687066 |
| ocean | #0D141F | #111A27 | #C2F3FF | #75C7F0 | #7CE2FE |
| indigo | #11131F | #141726 | #D6E1FF | #9EB1FF | #3E63DD |
| iris | #13131E | #171625 | #E0DFFE | #B1A9FF | #5B5BD6 |
| plum | #181118 | #201320 | #F4D4F4 | #E796F3 | #AB4ABA |
| ember | #181111 | #1F1513 | #FBD3CB | #FF977D | #E54D2E |
| ruby | #191113 | #1E1517 | #FED2E1 | #FF949D | #E54666 |
| gilded | #121211 | #1B1A17 | #E8E2D9 | #CBB99F | #978365 |

Light
| Key | Background | Surface | Text | Text Secondary | Accent |
| --- | ---------- | ------- | ---- | -------------- | ------ |
| paper | #FCFCFD | #F9F9FB | #1C2024 | #60646C | #8B8D98 |
| cloud | #FCFCFC | #F9F9F9 | #202020 | #646464 | #8D8D8D |
| dune | #FDFDFC | #F9F9F8 | #21201C | #63635E | #8D8D86 |
| sage | #FBFDFC | #F7F9F8 | #1A211E | #5F6563 | #868E8B |
| olive | #FCFDFC | #F8FAF8 | #1D211C | #60655F | #898E87 |
| sky | #F9FEFF | #F1FAFD | #1D3E56 | #00749E | #7CE2FE |
| periwinkle | #FDFDFE | #F7F9FF | #1F2D5C | #3A5BC7 | #3E63DD |
| lilac | #FDFDFF | #F8F8FF | #272962 | #5753C6 | #5B5BD6 |
| orchid | #FEFCFF | #FDF7FD | #53195D | #953EA3 | #AB4ABA |
| coral | #FFFCFC | #FFF8F7 | #5C271F | #D13415 | #E54D2E |
| rose | #FFFCFD | #FFF7F8 | #64172B | #CA244D | #E54666 |
| honey | #FDFDFC | #FAF9F2 | #3B352B | #71624B | #978365 |

### Test plan
- `pnpm test`
- Manual: open the editor and confirm 12 dark + 12 light themes fill rows at md (2 columns) and lg (3 columns).
- Manual: default theme is `graphite` when no `bgcolor`/`color` params are set.

### Acceptance criteria
- Theme catalog updated to Radix-derived values with 12 dark and 12 light options.
- `DEFAULT_THEME_KEY` updated to `graphite`, and fallback uses that key.
- Theme selector shows the new names and retains the "Custom" state for unmatched colors.

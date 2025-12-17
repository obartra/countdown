## Feature: Share link actions component (EditPage)

### Exact behavior
- In `src/EditPage.tsx`, replace the inline “Copy link” / “View” buttons + status text with a dedicated `ShareLinkActions` component.
- Introduce a “Share” section (heading + supporting microcopy) inside the parameters card that hosts the new component so the link controls live in their own visual area.
- The component renders:
  - The generated share URL inside a read-only text input that stretches to fill available width, selects/highlights its entire contents when the user focuses it, and exposes `break-all` wrapping for very long URLs.
  - Two icon-only buttons aligned on the same row: a copy action (`🔗` idle, ✅ copied, ⚠️ error) and a view action (`👁️`), both using the existing `Button` component with `size="icon"`.
- Copy behavior:
  - Clicking the copy button attempts to write the URL to the clipboard.
  - On success, replace the icon with ✅ for ~2 seconds and update the tooltip to “Copied!”.
  - On failure, show ⚠️ with the tooltip “Clipboard unavailable, copy manually.” for a short delay, then reset.
- View behavior:
  - Clicking the view button navigates to the share URL (same as current “View” behavior).
  - Tooltip text is “Switch to view mode”.
- Disabled state:
  - When `disabled` is true, both buttons are disabled while the input stays readable for manual copying.

### UI notes
- Keep the buttons and textbox on a single row with `flex` so they flow together even on narrow screens (`min-w-0` + `flex-1` for the input).
- Use button tooltips (`title`) and `aria-live` feedback for copy status updates.
- Style the textbox with border and focus ring to highlight it when focused.

### Test plan
- `pnpm types`
- `pnpm test`
- `pnpm lint`

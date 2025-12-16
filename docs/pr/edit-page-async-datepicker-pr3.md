## Feature: Async editor date picker UX polish (PR3)

Linked design: `docs/design/edit-page-async-datepicker.md`

### Exact behavior
- On `EditPage`, the date/time control stays as the async `react-datepicker` but now shows a quick preset row under the picker.
- Presets (local time): `+30m`, `+1h`, `Tomorrow 9:00 AM`. Clicking sets the picker value, updates helper text, and writes the ISO UTC `time` param used by preview/URL sync.
- When the picker has a value, show a compact readout block beneath the helper copy with the UTC ISO string and the localized display (including the current time zone name). Hide the readout when the value is empty/invalid.
- Existing behaviors stay: history `replaceState` keeps query params in sync as fields change; preview uses interpreted UTC; validation still shows an error when no valid time is selected; copy/open actions use the generated URL.

### UI notes
- Preset buttons use the small outline style and wrap on small screens.
- The readout block uses subtle border/background plus monospace text for the timestamps so UTC/local mapping is obvious.
- Keyboard input into the picker remains supported; the new presets are normal `button` elements.

### Edge cases
- Presets always compute from `Date.now()` in the user's local time zone (no server round trips).
- “Tomorrow 9:00 AM” always targets the next calendar day at 9:00 local, even if currently before 9:00.
- Clearing or deleting the time resets to the validation state (no readout, helper shows).

### Test plan
- `pnpm test`

## Feature: Admin auth typing + test stabilization

### Goals
- Fix the `VerifyAdminSecretResult` type usage so `pnpm types` passes.
- Update admin page unit tests to account for the `/admin-stats` verification call.
- Ensure unit and e2e tests pass.

### Exact behavior
- `useAdminAuth` handles failed verification using a type-safe branch (no TS errors).
- Unit tests that mock `fetch` include `/admin-stats` responses with a `text()` fallback for error cases.
- Admin reports tests handle the initial verification call before loading reports/published lists.

### Test plan
- `pnpm types`
- `pnpm test`
- `pnpm test:e2e`

### Acceptance criteria
- `pnpm types` completes with no errors.
- Unit tests pass without admin auth-related failures.
- e2e tests pass.

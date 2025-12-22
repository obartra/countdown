## Feature: Netlify Blobs storage in production

### Context
The current blob shim writes to the local filesystem, which is ephemeral in
Netlify Functions. Published slugs and admin stats disappear between invocations.

### Exact behavior
- Use Netlify Blobs for storage when running in Netlify production.
- Keep filesystem storage for local dev/tests.
- Allow an override via `COUNTDOWN_STORAGE_DRIVER=fs|blobs`.
- Store all blob keys under a single Netlify Blobs store.
- Initialize Netlify Blobs context in Lambda compatibility mode using the function event.
- Allow manual Blobs configuration via `COUNTDOWN_BLOBS_SITE_ID` and `COUNTDOWN_BLOBS_TOKEN` if the environment context is unavailable.

### Test plan
- `pnpm test`
- Deploy and verify: publish a slug, then load `/v/:slug` and view `/admin`.

### Acceptance criteria
- [ ] Published slugs persist across function invocations in production.
- [ ] Local dev/tests still use filesystem storage.
- [ ] No more 502s from storage directory creation in production.
> **Status: Implemented**

## Feature: Clean e2e shutdown for dev server

### Exact behavior
- Add a dedicated `e2e:start` script that runs the Vite dev server and Netlify functions server in parallel (equivalent to `pnpm dev` + `pnpm functions:serve`).
- The e2e server wrapper exits with code 0 when it receives SIGINT or SIGTERM (intentional shutdown).
- If either child process exits unexpectedly (non-zero or exit without shutdown signal), stop the other and exit non-zero.
- Update `test:e2e` and `test:e2e:open` to start the server via the e2e wrapper command instead of `start`.

### Test plan
- `pnpm test:e2e` and confirm no "exited with code 1 because the dev server is SIGINT'd during shutdown" message when tests pass.
- `pnpm test:e2e:open` and close the run; ensure the wrapper exits cleanly.

### Acceptance criteria
- [ ] E2E dev server shuts down with a zero exit code on SIGINT/SIGTERM.
- [ ] Unexpected server exits still fail the e2e run.
- [ ] `test:e2e` and `test:e2e:open` use the new e2e start script.
> **Status: Implemented**

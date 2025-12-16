# AGENTS.md — Codex Working Agreement for This Repo

This repository uses a docs-first workflow to keep AI-assisted changes reliable, reviewable, and consistent.

## Core Principle

**Docs are the contract. Code must follow docs.**
When docs and code conflict, resolve explicitly.

---

## Required Workflow

### For any non-trivial change (default)

1. **Map / Understand (Read-only)**
   - Identify relevant files and current behavior using repo evidence.
2. **Define the contract (Docs-only)**
   - Create/update a feature design doc under `docs/design/` **or** a PR brief under `docs/pr/`.
3. **Slice into PRs**
   - Break work into independently mergeable PRs.
4. **Implement exactly one PR at a time**
   - Each PR implements **exactly one** `docs/pr/*.md`.
5. **Verify**
   - Run the repo’s verification commands (tests/lint/typecheck/build).
6. **Reconcile**
   - If implementation differs from docs, propose a patch to either code or docs.

### Docs structure

- `docs/design/` — feature-level contracts (goals, non-goals, behavior, invariants, test plan)
- `docs/pr/` — PR-level contracts (one file per PR, concrete and testable)
- `docs/plan.md` — short execution plan / roadmap for current initiative(s)

---

## Strict Guardrails (Codex must follow)

### Default mode

- Start in **read-only** until explicitly instructed: “enter Build Mode” or “implement PR doc X”.
- Do not edit production code while in read-only or docs-only tasks.

### No guessing rule

- If requirements are missing or ambiguous:
  - **STOP**
  - present 2–3 options with tradeoffs
  - ask the minimum clarifying questions
  - do not proceed without a decision

### Scope control

- Keep diffs small and reviewable.
- No drive-by refactors (no unrelated cleanup).
- Prefer adding new files/modules over rewriting unrelated code.
- Only touch files required by the PR contract.

### Evidence-based documentation

- Docs must only claim what can be supported by:
  - code/config/scripts in the repo, or
  - explicit assumptions labeled as ASSUMPTION/UNKNOWN.

### Implementation fidelity

- When implementing, follow `docs/pr/<slug>.md` exactly.
- If the PR brief conflicts with repo reality, stop and propose a reconciliation plan.

---

## React + TypeScript + Vite Repo Conventions (Target)

As this repo is migrating to React/TypeScript/Vite, follow these conventions unless the repo explicitly differs:

### Entry points and config

- Vite entry: `index.html`
- App entry: `src/main.tsx`, `src/App.tsx`
- Config: `vite.config.ts`, `tsconfig*.json`
- Assets:
  - Static public assets: `public/`
  - Imported assets: `src/assets/`

### Deployment (subpath hosting risk)

If deploying to GitHub Pages or any subpath:

- Validate and document `vite.config.ts` `base`
- Ensure routing strategy works under a subpath (HashRouter or basename)

---

## Verification (Required)

Each PR brief must include verification commands.
Use the repo’s package manager and scripts. If missing, propose adding them.

Typical commands:

- Install: `npm ci` (or `pnpm i --frozen-lockfile` / `yarn --frozen-lockfile`)
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Test: `npm run test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck` (recommended `tsc --noEmit`)

If commands fail, report:

- what you ran
- what failed
- the minimal fix
- whether the failure is pre-existing or introduced

---

## Output Expectations (How Codex should respond)

### For read-only analysis

- Provide a concise summary.
- Cite file paths for claims.
- List unknowns explicitly.

### For docs-only changes

- Keep docs tight and actionable.
- Avoid speculative instructions.

### For implementation

- Start with a short plan + files to touch.
- Implement the PR contract.
- Add/update tests.
- Run verification commands and report results.
- Summarize changes + deferred items.

---

## Team Consistency Rules

- One PR ↔ one `docs/pr/*.md`.
- PR description must link to:
  - the PR brief doc (`docs/pr/...`)
  - and any relevant design doc (`docs/design/...`)
- If a PR changes `src/**`, it should generally include a docs/pr update.
- Prefer incremental PRs to large “big bang” changes.

---

## Stop Conditions (Mandatory)

Codex must stop and ask if:

- requirements are ambiguous
- a change would touch many unrelated files
- deployment assumptions (base path/routing) are unknown but impactful
- tests/tooling are missing and changes would be unverified

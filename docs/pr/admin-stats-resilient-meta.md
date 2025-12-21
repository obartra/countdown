## Feature: Resilient admin stats meta reads

### Context
Admin auth uses `/admin-stats` for verification. If a malformed metadata file exists,
`storageClient.listMeta()` can throw and the endpoint returns a 500, blocking admin login.

### Exact behavior
- When listing metadata entries, skip unreadable or invalid JSON files instead of throwing.
- Log a warning with the slug and error when a metadata entry cannot be parsed.
- Continue returning stats for any valid metadata files.

### Test plan
- `pnpm test` (covers Netlify function tests)

### Acceptance criteria
- [ ] `admin-stats` no longer fails if a single metadata JSON file is malformed.
- [ ] Valid metadata files still contribute to stats.
> **Status: Implemented**

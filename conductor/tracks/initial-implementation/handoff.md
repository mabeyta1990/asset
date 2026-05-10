# Handoff: Repo Context Bootstrap + Invalidation

## Objective
Implement a robust initialization and change-detection system for the ASSET pipeline. This ensures that the pipeline's cache and canonical state are strictly scoped to the repository and automatically invalidated when core project documentation or schemas change.

## Tasks
1. **Initialize Repo-Scoped State:** 
   - Define a static UUID in `.ai-memory/repo-id`. If `.ai-memory/repo-id` already exists, read and return the existing UUID. Generate and write a new UUID only on first run.
   - Ensure `src/memory.ts` and `src/cache/refresh.ts` use this ID to partition cache and canonical data.
2. **Implement `src/scripts/bootstrap.ts`:**
   - Create a CLI script to perform one-time project setup.
3. **Stable Context Hashing:**
   - Implement a utility to scan `docs/` and project schemas.
   - Generate a manifest of content hashes.
   - Create a `checkContextChange()` function to compare current hashes against the stored manifest, triggering a full cache invalidation if detected.
   - **Fatal Failure:** If an invalidation or state update error occurs, the pipeline MUST terminate with a fatal error.

## Requirements
- **No direct edits to `package.json` or `tsconfig.json`.**
- **Idempotency:** `bootstrap.ts` must be safe to run multiple times.
- **Hashing:** Use `SHA-256` for file contents.
- **Isolation:** All generated metadata must be stored within the `.ai-memory/` directory.

## Constraints
- **Scope:** Changes restricted to `src/` (excluding `wrappers/`), `src/scripts/`, and `src/pipeline.ts`.
- **Integration:** The `runPipeline` entry point must call the validation check before beginning any new session.

## Verification
- Verify that modifying a file in `docs/` triggers a hash mismatch on the next pipeline run.
- Verify that the cache is properly invalidated/refreshed upon detecting the change.
- Confirm that cache invalidation errors result in a fatal pipeline failure.

## Status
 - Task State: REVIEW_REQUIRED
 - Assigned To: Gemini CLI

## Implementation Notes
- Created `src/context-hash.ts`: exports `getRepoId()`, `computeHash()`, `manifestsMatch()`, `checkContextChange()`.
  - `getRepoId()` reads `.ai-memory/repo-id`; generates and writes a UUID on first run.
  - `checkContextChange(repoId, readCanonical, deleteCache)` accepts injected dependencies to keep it testable and avoid deep coupling. It scans `docs/` + `package.json`/`tsconfig.json` with SHA-256, compares against stored manifest at `.ai-memory/{repoId}/canonical/context-manifest.json`. On first run, stores manifest (no invalidation). On change, calls `deleteCache` for the stored Gemini cache name, then writes the new manifest. Any error is re-thrown as `"Fatal: context invalidation failed — ..."`.
- `src/memory.ts`: added `configureMemory(repoId)` which sets the sessions root to `.ai-memory/{repoId}/sessions/`.
- `src/cache/canonical.ts`: added `configureCanonical(repoId)` which scopes all reads to `.ai-memory/{repoId}/canonical/`.
- `src/cache/refresh.ts`: added `configureRefresh(repoId)` (scopes canonical + staging dirs) and `getStagingDir()` getter. Removed `STAGING_DIR`/`CANONICAL_DIR` hardcoded constants, replaced with `let` variables.
- `src/pipeline.ts`: `runPipeline` now calls `getRepoId()`, then configures all three modules, then `checkContextChange()`, before `initSession()`. `stagingDir` is now derived via `getStagingDir()`.
- `src/scripts/bootstrap.ts`: idempotent CLI script that calls `getRepoId()` and `mkdir -p` for all three repo-scoped subdirectories.
- `src/context-hash.test.ts`: 13 unit tests covering `computeHash` (determinism, known SHA-256) and `manifestsMatch` (add/remove/change/order-independent).
- `tsc --noEmit` passes clean. `vitest run` passes all 31 tests.

## Blockers
None.

## Local Verification
- Type-check: PASS (npx tsc --noEmit)
- Unit tests: PASS (vitest — 32 tests, +1 invalidation-failure test)
- Verification command: npx tsc --noEmit && npx vitest run
- Verified on: 2026-05-09
- Invalidation-failure test: PASS (src/context-hash.invalidation.test.ts — commit 3d96941)

## Handoff Back to Gemini
Implementation complete. All tasks in the handoff are fulfilled:
1. `.ai-memory/repo-id` UUID scheme implemented and wired into session/canonical/staging paths.
2. `src/scripts/bootstrap.ts` is idempotent and initializes all three repo-scoped directories.
3. Context hashing scans `docs/` + project schemas with SHA-256, stores manifest per repo, and triggers full Gemini cache invalidation on change with fatal error propagation.
4. `runPipeline` calls `checkContextChange` before any session begins.

Pending verification steps (require live pipeline run):
- Mutate a `docs/` file and confirm hash mismatch triggers Gemini cache deletion on next run.
- Confirm invalidation errors (e.g., network failure during `deleteStaleCaches`) surface as fatal pipeline termination.

## Handoff for Claude: Add unit test for invalidation failure

Objective
- Add a focused unit test that simulates a failure during cache deletion and asserts that checkContextChange surfaces a fatal error (the pipeline must rethrow as `Fatal: context invalidation failed — ...`). This allows verification without executing the full sandbox VM.

Next step from plan.md
- Verification step #3: "Simulate deleteStaleCaches failure (network block or stub) and re-run: pipeline must raise fatal error; capture logs." Implement a unit test to reproduce the failure mode and assert error behavior.

Relevant files
- src/context-hash.ts (checkContextChange)
- New test to create: src/context-hash.invalidation.test.ts

Task scope
- Create a new vitest test file at `src/context-hash.invalidation.test.ts`.
- The test should:
  1. Prepare a repo-scoped manifest file at `.ai-memory/test-repo-invalidation/canonical/context-manifest.json` with a `files` map that differs from the current repo files (so the stored manifest does not match the newly computed manifest).
  2. Call `checkContextChange(repoId, readCanonicalStub, deleteCacheStub)` where `deleteCacheStub` throws `new Error('delete failed')` and `readCanonicalStub` returns either `null` or a minimal canonical shape.
  3. Assert that `checkContextChange` rejects with an Error whose message starts with `Fatal: context invalidation failed`.

Constraints
- Only add the new test file; do NOT modify existing implementation files.
- Use vitest APIs (import { expect, it } from 'vitest').
- Keep the test self-contained (create and clean up `.ai-memory/test-repo-invalidation` path as needed).
- Do not call or modify networked services — this is a pure unit test using a stubbed `deleteCache`.

Expected outcome
- New test `src/context-hash.invalidation.test.ts` compiles and fails (it should assert that implementation throws). The test passes if implementation correctly rethrows fatal error on deleteCache failure (i.e., test expects rejection).

Verification needed
- After adding the test, run `npx vitest run src/context-hash.invalidation.test.ts` locally (or in CI) to confirm the test behaves as expected.
- Commit the new test and push; record the test run output in `conductor/tracks/initial-implementation/handoff.md` under Local Verification.

Handoff for Claude
- Implement the new test file at `src/context-hash.invalidation.test.ts` exactly as scoped above.
- Commit with message: `test(context-hash): add invalidation-failure unit test` and include Co-authored-by trailer.
- Return the test output and the commit SHA so the orchestrator can attach verification logs to handoff.md.


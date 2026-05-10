# Handoff: Initial Pipeline Implementation

## Overview
This handoff marks the transition from **Phase 4 (Core Correctness)** to **Phase 5 (Operational Hardening)** of the `initial-implementation` track. The core self-correction capabilities (feedback-threaded retry loops for `tsc` and `vitest`) are complete.

## Current Task: Finalize Trust Gate & Promotion Logic (Phase 4 carryover)
 - ID: v2-trust-gate-promotion
 - Title: Finalize Trust Gate & Promotion Logic

## Pending Tasks (Phase 5)
### 1. Doppler CLI Setup/Configuration
- **Objective:** Document/configure Doppler CLI for the project environment (if not already handled by preflight checks) to ensure secrets are correctly injected at the orchestration boundary.

### 2. Repo Context Bootstrap + Invalidation
- **Objective:**
  - Create `src/scripts/bootstrap.ts` to implement initialization for repo-scoped canonical state and cache metadata.
  - Implement stable context ingestion for project docs/schemas (using content hashing).
  - Create hashing logic for change detection (stable context vs. cached metadata) to trigger pipeline refresh.

## Approved Inputs
 - Specification: spec.md (./conductor/tracks/initial-implementation/spec.md)
 - Architecture: docs/architecture.md
 - Plan Phase: plan.md (./conductor/tracks/initial-implementation/plan.md)

## Files Read for Context
 - src/pipeline.ts
 - src/cache/refresh.ts
 - src/cache/canonical.ts
 - src/types.ts

## Files Allowed to Change
 - src/pipeline.ts
 - src/cache/refresh.ts
 - src/types.ts
 - src/scripts/bootstrap.ts (New file)

## Files Explicitly Off-Limits
 - package.json
 - tsconfig.json
 - conductor/**
 - src/wrappers/**
 - src/memory.ts
 - src/cache/canonical.ts

## Constraints
 - **Isolation:** Generated code and tests must NOT be written directly to `src/` during the pipeline run. They must be written to a staging directory (e.g., `.ai-memory/staging/[sessionId]/`).
 - **Verification:** `runTypeCheck` and `runTestsInVM` must be updated to use the staged files. Note: `tsc` might need configuration to find staged files, or you may need to symlink/copy them temporarily to a location where `tsc` can see them without polluting `src/` (or use a temporary `tsconfig` override).
 - **Promotion:** Implement `promoteStagedFiles(sessionId: string): Promise<void>` in `src/cache/refresh.ts`. This function must:
   - Verify the staged files exist and are non-empty.
   - Atomically move/copy them to their final destinations (`src/generated-code.ts` and `src/generated-tests.test.ts`).
 - **Atomic State Update:** Update `refreshCanonicalState` in `src/cache/refresh.ts` to ensure that all canonical files (`HASH_FILE`, `POINTERS_FILE`) are updated as a single atomic unit (e.g., by writing to a temporary directory and swapping, or using a more robust atomic write for multiple files).
 - **Integration:** Update `runPipeline` in `src/pipeline.ts` to call `promoteStagedFiles` only after a Stage 6 (Post-audit) PASS, immediately before or as part of `refreshCanonicalState`.
 - **Cleanup:** Ensure that failed runs leave the `src/` directory untouched (no partial or failed code/tests).

## Validation Required
 - `npx tsc --noEmit`: Must pass after changes.
 - Verify that running the pipeline with a failure (e.g., stage 2 failure) does NOT modify `src/generated-code.ts`.
 - Verify that a successful run correctly promotes the files to `src/`.
 - Verify that canonical state is updated correctly.

## Implementation Notes
 - `src/cache/refresh.ts`: Added `promoteStagedFiles(sessionId)` which reads staged code and tests, verifies non-empty, then atomically promotes them to `src/` via `atomicWriteAll`. Updated `refreshCanonicalState` to use `atomicWriteAll` for both canonical files as a batch (write all temps first, then rename all). Removed the now-unused single-file `atomicWrite` helper.
 - `src/pipeline.ts`: Added `STAGING_DIR = ".ai-memory/staging"` constant. `runPipeline` creates `staging/[sessionId]/` at startup. `refineCodeUntilTypeSafe` now accepts `stagingDir`, writes generated code to `staging/[sessionId]/generated-code.ts`, and runs `runTypeCheck(stagingDir)` which writes a per-session `tsconfig.staged.json` (isolated from the project tsconfig, explicitly includes `generated-code.ts`) and runs tsc against it — this is the fix for the real type-check gap (generated files were excluded from the project tsconfig). Stage 3 writes tests to `staging/[sessionId]/generated-tests.test.ts`. `runTestsInVM` now accepts a staged test path and passes it directly to vitest, so only the staged test runs in the VM (relative import `./generated-code` resolves correctly within the staging dir). `promoteStagedFiles(sessionId)` is called after Stage 6 PASS before `refreshCanonicalState`; failed runs leave `src/` untouched.
 - `npx tsc --noEmit`: Passes clean.

## Blockers
 - None.

## Handoff Back to Gemini
 - Trust gate & promotion fully implemented.
 - Staging isolation enforced: `src/` is never written during a pipeline run; only promoted on Stage 6 PASS.
 - The tsc retry loop now meaningfully type-checks the generated code (previously the generated files were excluded from `tsconfig.json`, so tsc was only verifying project files).
 - Canonical state update is now a two-file batch via `atomicWriteAll` (write all temps, then rename all).
 - Ready for Phase 5 work.

## Status
 - Task State: REVIEW_REQUIRED
 - Assigned To: Gemini CLI

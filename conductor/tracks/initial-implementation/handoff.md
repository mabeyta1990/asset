Handoff: Initial Pipeline Implementation - Phase 4 (Finalize Trust Gate & Promotion Logic)

  Current Task
   - ID: v2-trust-gate-promotion
   - Title: Finalize Trust Gate & Promotion Logic

  Approved Inputs
   - Specification: spec.md (./conductor/tracks/initial-implementation/spec.md)
   - Architecture: docs/architecture.md
   - Plan Phase: plan.md (./conductor/tracks/initial-implementation/plan.md)

  Files Read for Context
   - src/pipeline.ts
   - src/cache/refresh.ts
   - src/cache/canonical.ts
   - src/types.ts

  Files Allowed to Change
   - src/pipeline.ts
   - src/cache/refresh.ts
   - src/types.ts

  Files Explicitly Off-Limits
   - package.json
   - tsconfig.json
   - conductor/**
   - src/wrappers/**
   - src/memory.ts
   - src/cache/canonical.ts

  Constraints
   - **Isolation:** Generated code and tests must NOT be written directly to `src/` during the pipeline run. They must be written to a staging directory (e.g., `.ai-memory/staging/[sessionId]/`).
   - **Verification:** `runTypeCheck` and `runTestsInVM` must be updated to use the staged files. Note: `tsc` might need configuration to find staged files, or you may need to symlink/copy them temporarily to a location where `tsc` can see them without polluting `src/` (or use a temporary `tsconfig` override).
   - **Promotion:** Implement `promoteStagedFiles(sessionId: string): Promise<void>` in `src/cache/refresh.ts`. This function must:
     - Verify the staged files exist and are non-empty.
     - Atomically move/copy them to their final destinations (`src/generated-code.ts` and `src/generated-tests.test.ts`).
   - **Atomic State Update:** Update `refreshCanonicalState` in `src/cache/refresh.ts` to ensure that all canonical files (`HASH_FILE`, `POINTERS_FILE`) are updated as a single atomic unit (e.g., by writing to a temporary directory and swapping, or using a more robust atomic write for multiple files).
   - **Integration:** Update `runPipeline` in `src/pipeline.ts` to call `promoteStagedFiles` only after a Stage 6 (Post-audit) PASS, immediately before or as part of `refreshCanonicalState`.
   - **Cleanup:** Ensure that failed runs leave the `src/` directory untouched (no partial or failed code/tests).

  Validation Required
   - `npx tsc --noEmit`: Must pass after changes.
   - Verify that running the pipeline with a failure (e.g., stage 2 failure) does NOT modify `src/generated-code.ts`.
   - Verify that a successful run correctly promotes the files to `src/`.
   - Verify that canonical state is updated correctly.

  Status
   - Task State: IN_PROGRESS
   - Assigned To: Claude Code

# Implementation Plan: Initial Pipeline Implementation

## Current Status
- DONE: Core Wrappers (Claude, Gemini, Perplexity, GLM, Nemotron) with caching.
- DONE: Memory & Persistence (Session/Canonical state infrastructure).
- DONE: Orchestration & CLI (Initial pipeline and CLI entry point).
- DONE: State Machine Refactor (Type-safe state transitions).
- DONE: Feedback-Threaded Retry Logic (Phase 1: `tsc` compilation errors).
- DONE: Feedback-Threaded Retry Logic (Phase 2: `vitest` execution errors).
- DONE: Doppler Secrets Integration — core implementation complete; user/CI Doppler setup required.
- DONE: Repo-context bootstrap & invalidation — locally verified; see handoff.md Phase 5 Verification.

---

## Phase 4: Core Correctness (DONE)
*Focus: Ensuring the pipeline produces valid, tested, and audited code through feedback loops.*

- [x] **Implement Feedback-Threaded Retry for `tsc` Errors (Phase 1)**
    - [x] Update `src/types.ts`: Add `TYPE_CHECK_FEEDBACK` to `PipelineEvent`.
    - [x] Implement `runTypeCheck()` and `parseTscDiagnostics()` in `src/pipeline.ts`.
    - [x] Implement `refineCodeUntilTypeSafe()` retry loop.
- [x] **Implement Feedback-Threaded Retry for `vitest` Errors (Phase 2)**
    - [x] Update `src/types.ts`: Add `TEST_FEEDBACK` to `PipelineEvent` and update `coding` state.
    - [x] Implement `parseVitestDiagnostics(vitestOutput: string): string` in `src/pipeline.ts`.
        - *Requirement:* Extract failing test names, error messages, and execution traces.
    - [x] Refactor `runPipeline` to support looping back to Stage 2 (Code) on Stage 5 (Execution) failure.
        - *Constraint:* Max 3 retries for the entire loop (defined by `MAX_RETRIES_TEST_FAILURE`).
        - *Constraint:* Regenerated code MUST trigger a re-run of Stage 3 (Tests), Stage 4 (Pre-audit), Stage 5 (Execution), and Stage 6 (Post-audit).
    - [x] Update `buildCodeRetryTask` to handle both `tsc` and `vitest` feedback types cleanly.
- [x] **Finalize Trust Gate & Promotion Logic**
    - [x] Ensure `src/cache/refresh.ts` only updates canonical state on a Stage 6 (Post-audit) PASS.
    - [x] Implement atomic promotion: Use temporary staging for canonical updates; never overwrite or pollute with failed/in-flight run data.

---

## Phase 5: Operational Hardening

### Repo Context Bootstrap + Repo-Scoped Invalidation (DONE)
All Phase 5 repo-context tasks are complete and locally verified:
1. ✓ Repo-scoped UUID in `.ai-memory/repo-id`
2. ✓ `src/scripts/bootstrap.ts` (idempotent)
3. ✓ Context hashing with SHA-256 and change detection
4. ✓ Atomic cache invalidation on context change
5. ✓ Fatal error propagation on invalidation failure

**Verification:** See handoff.md "Phase 5 Verification — DONE" (commit d7985ae)
- Type-check: PASS
- Unit tests: PASS (32/32)
- Invalidation-failure test: PASS

### Doppler Secrets Integration (DONE)
- Core implementation: `assertEnv()` checks in src/pipeline.ts.
- Documentation: Secrets are managed via Doppler; `assertEnv()` ensures they are present before run.

### Sandbox Hardening (IN PROGRESS)
- [ ] Enhance OrbStack/Ubuntu VM isolation.
    - *Requirement:* Restricted repo mounts (Read-only for host repo → VM `/workspace`).
    - *Requirement:* Network isolation for untrusted code execution.

### Telemetry & Monitoring (IN PROGRESS)
- [ ] Implement telemetry hooks/interfaces for tracking operational data.
    - *Requirement:* Capture `durationMs` for every pipeline stage execution.
    - *Requirement:* Capture normalized token usage (prompt/completion) for every model (Gemini, Copilot, Claude) per-run.
    - *Requirement:* Implement cost tracking per-model (where pricing is available). If pricing is unavailable, normalized token tracking is sufficient.
    - *Requirement:* Aggregate and report total session cost/latency.

---

## Phase 6: Optimization & Validation
*Focus: Performance tuning and end-to-end reliability.*

- [ ] **Prompt Optimization**
    - [ ] Stabilize and refine prompt templates in `src/cache/prefixes.ts`.
    - [ ] Implement dynamic prompt selection based on task complexity or prior stage quality.
- [ ] **Final E2E Validation**
    - [ ] End-to-end smoke test validation with real-world task scenarios.
    - [ ] Verify 5-minute performance envelope for cached runs.

---

## Phase 7: Deferred Integrations
*Focus: External ecosystem connections (Deferred until core is stable).*

- [ ] **Notion Integration:** Native Notion Markdown ingestion and roadmap sync.
- [ ] **Slack Integration:** Slack webhook integration for failure escalations.

---

## Notes & Assumptions
- **Source of Truth:** The implementation must always align with `docs/architecture.md`.
- **State Separation:** Session state is ephemeral (lives and dies with the run); Canonical state is durable (updates only on PASS).
- **Execution Environment:** All code execution happens within the isolated OrbStack/Ubuntu VM.
- **Rationale for Ordering:** Vitest retry logic is prioritized as it completes the core "Self-Correction" capability of the pipeline, which is essential for "Core Correctness" before hardening the operational environment.

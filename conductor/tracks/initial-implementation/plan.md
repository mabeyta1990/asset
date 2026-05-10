# Implementation Plan: Initial Pipeline Implementation

## Current Status
- **DONE:** Core Wrappers (Claude, Gemini, Perplexity, GLM, Nemotron) with caching.
- **DONE:** Memory & Persistence (Session/Canonical state infrastructure).
- **DONE:** Orchestration & CLI (Initial pipeline and CLI entry point).
- **DONE:** State Machine Refactor (Type-safe state transitions).
- **DONE:** Feedback-Threaded Retry Logic (Phase 1: `tsc` compilation errors).

---

## Phase 4: Core Correctness (In-Progress)
*Focus: Ensuring the pipeline produces valid, tested, and audited code through feedback loops.*

- [x] **Implement Feedback-Threaded Retry for `tsc` Errors (Phase 1)**
    - [x] Update `src/types.ts`: Add `TYPE_CHECK_FEEDBACK` to `PipelineEvent`.
    - [x] Implement `runTypeCheck()` and `parseTscDiagnostics()` in `src/pipeline.ts`.
    - [x] Implement `refineCodeUntilTypeSafe()` retry loop.
- [ ] **Implement Feedback-Threaded Retry for `vitest` Errors (Phase 2)**
    - [ ] Update `src/types.ts`: Add `TEST_FEEDBACK` to `PipelineEvent` and update `coding` state.
    - [ ] Implement `parseVitestDiagnostics(vitestOutput: string): string` in `src/pipeline.ts`.
        - *Requirement:* Extract failing test names, error messages, and execution traces.
    - [ ] Refactor `runPipeline` to support looping back to Stage 2 (Code) on Stage 5 (Execution) failure.
        - *Constraint:* Max 3 retries for the entire loop (defined by `MAX_RETRIES_TEST_FAILURE`).
        - *Constraint:* Regenerated code MUST trigger a re-run of Stage 3 (Tests), Stage 4 (Pre-audit), Stage 5 (Execution), and Stage 6 (Post-audit).
    - [ ] Update `buildCodeRetryTask` to handle both `tsc` and `vitest` feedback types cleanly.
- [ ] **Finalize Trust Gate & Promotion Logic**
    - [ ] Ensure `src/cache/refresh.ts` only updates canonical state on a Stage 6 (Post-audit) PASS.
    - [ ] Implement atomic promotion: Use temporary staging for canonical updates; never overwrite or pollute with failed/in-flight run data.

---

## Phase 5: Operational Hardening
*Focus: Security, stability, and repo-specific context management.*

- [ ] **Doppler Secrets Integration**
    - [x] Core code implementation (Preflight checks and `assertEnv` at orchestration boundary).
    - [ ] User/CI setup for Doppler CLI (Environment/Injection configuration).
- [ ] **Repo Context Bootstrap + Repo-Scoped Invalidation**
    - [ ] Implement repo-scoped canonical state and cache metadata initialization.
        - *Requirement:* All cache namespaces and canonical paths must be scoped by repo identity.
    - [ ] Create `src/scripts/bootstrap.ts` for first-time project link/setup.
    - [ ] Implement stable context ingestion (README, architecture, schema, etc.) using content hashing.
    - [ ] Build hashing logic for change detection (stable context vs. cached metadata) to trigger refresh.
- [ ] **Sandbox Hardening**
    - [ ] Enhance OrbStack/Ubuntu VM isolation.
        - *Requirement:* Restricted repo mounts (Read-only for host repo → VM `/workspace`).
        - *Requirement:* Network isolation for untrusted code execution.
- [ ] **Telemetry & Monitoring**
    - [ ] Implement lightweight telemetry hooks/interfaces in `pipeline.ts` for per-run cost and performance monitoring.

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

# Implementation Plan: Initial Pipeline Implementation

## Overview
Status of the initial pipeline implementation roadmap for the ASSET project.

## Completed Phases

### Phase 1-3: Core Infrastructure (DONE)
- [x] **Wrappers:** Claude, Gemini, Perplexity (Changed to Tavily), GLM, Nemotron implementations with caching.
- [x] **Memory & Persistence:** Session and canonical state infrastructure.
- [x] **Orchestration & CLI:** Initial pipeline and CLI entry point.

### Phase 4: Core Correctness (DONE)
- [x] **Feedback-Threaded Retry (TSC):** `tsc` error parsing and `refineCodeUntilTypeSafe` retry loop.
- [x] **Feedback-Threaded Retry (Vitest):** `vitest` failure parsing and pipeline re-run orchestration (max 3 retries).
- [x] **Trust Gate & Promotion:** Atomic promotion to canonical state on post-audit PASS.

### Phase 5: Operational Hardening (Pending)
- [x] **Context Management:** Repo-scoped bootstrap, hashing, and atomic invalidation.
- [x] **Doppler Secrets:** Integration via `assertEnv()` (Pending: Configure `TAVILY_API_KEY` for pipeline/sandbox execution).
- [x] **Sandbox Hardening:** VM isolation, network namespaces, read-only mounts.
- [x] **Telemetry:** Operational tracking (duration, usage, cost).

### Phase 6: Optimization & Validation (In Progress)
- [x] **Prompt Optimization:** Refactored hardcoded prompts to registry and implemented two-stage audit split.
- [x] **Final E2E Validation:** End-to-end smoke test validation and performance envelope verification.
- [x] **Claude Prompt Caching:** Fixed Haiku 4.5 caching by meeting 4096-token minimum floor in stable blocks.
- [x] **Per-Stage Model Selection (DONE)**
- [x] **Model Dispatch & CLI Integration (DONE)**
- [x] **Comprehensive Telemetry & Pricing (DONE)**
- [x] **Interactive Mode (DONE)**

- [ ] **Multi-File Generation (Next Priority)**
    - [ ] Extend task spec to declare multiple output files.
    - [ ] Define code-stage output schema as `files: { path, content }[]`.
    - [ ] Stage each generated file independently in the session workspace.
    - [ ] Validate all generated files before any promotion occurs.
    - [ ] Promote all files atomically as a single batch.
    - [ ] Fail the whole batch if any file fails `tsc`, `vitest`, or audit.
    - [ ] Add unit/integration coverage for partial-failure rollback.

- [ ] **Surgical File Edits**
    - [ ] Add task-spec support for `mode: "create" | "patch"`.
    - [ ] Define patch payload schema, preferably `{ find: string, replace: string }[]`.
    - [ ] Implement Stage 2 patch-mode prompting using target-file context.
    - [ ] Add apply-patch step before Stage 3 (Tests).
    - [ ] Enforce exact-once `find` matching.
    - [ ] Add normalize/fuzzy-match fallback for whitespace and quote drift.
    - [ ] Fail fast on ambiguous or missing matches.
    - [ ] Add unit tests for patch apply success, zero-match failure, and multi-match failure.

- [ ] **Repo File Insertion**
    - [ ] Add optional `insertPath` field to task spec.
    - [ ] Validate `insertPath` stays within repo root boundaries.
    - [ ] Keep insertion disabled unless explicitly requested.
    - [ ] Insert only after post-audit PASS and atomic promotion.
    - [ ] Prevent writes outside the repo on malformed or traversal paths.
    - [ ] Add tests for valid insert, invalid path rejection, and traversal rejection.

- [ ] **Task Chaining / Dependencies**
    - [ ] Add `dependsOn: string[]` support to task spec.
    - [ ] Validate all dependency task IDs exist.
    - [ ] Require dependency tasks to have post-audit PASS before execution.
    - [ ] Inject promoted dependency output into downstream task context.
    - [ ] Fail chained runs when any upstream dependency failed.
    - [ ] Add tests for single dependency, multi-dependency, and failed dependency handling.

- [x] **Task Spec Validation (DONE)**
    - [x] Define strict schema for task spec fields.
    - [x] Validate required fields before Stage 0 begins.
    - [x] Validate enums such as `mode`, model names, and target values.
    - [x] Validate path-shaped fields such as `insertPath`.
    - [x] Return clear user-facing validation errors.
    - [x] Add tests for malformed, missing, and unsupported fields.

- [ ] **Dry-Run / Preview Mode**
    - [ ] Add `--dry-run` CLI flag.
    - [ ] Resolve and validate task spec without writing files.
    - [ ] Run only pre-generation planning stages.
    - [ ] Print planned outputs, target paths, and selected models.
    - [ ] Skip code generation, staging writes, tests, and promotion.
    - [ ] Add tests proving dry-run has zero write side effects.

- [ ] **Session Diff Viewer**
    - [ ] Compute unified diff between previous canonical state and promoted output.
    - [ ] Persist diff artifact in session JSON or adjacent file.
    - [ ] Support single-file and multi-file diff output.
    - [ ] Truncate or summarize very large diffs safely.
    - [ ] Add tests for no-op diff, single-file diff, and multi-file diff rendering.

- [x] **Cost Dashboard (DONE)**
    - [x] Aggregate session JSON telemetry across runs.
    - [x] Group totals by model.
    - [x] Group totals by stage.
    - [x] Group totals by task ID.
    - [x] Expose summary via CLI command such as `asset cost --summary`.
    - [x] Handle partially priced providers safely.
    - [x] Add tests for aggregation correctness.

- [ ] **Failure Taxonomy**
    - [ ] Define canonical failure categories, e.g. `tsc-error`, `vitest-error`, `audit-fail`, `api-error`, `patch-conflict`, `spec-invalid`.
    - [ ] Assign failure category at session write time.
    - [ ] Persist category in session JSON.
    - [ ] Expose aggregate counts via CLI summary command.
    - [ ] Add tests for category assignment across representative failures.

- [ ] **Prompt Versioning**
    - [ ] Assign stable version hashes to prompt templates.
    - [ ] Store prompt version per stage in session JSON.
    - [ ] Update prompt-loading utilities to expose version metadata.
    - [ ] Include prompt version in cost/failure analysis outputs.
    - [ ] Add tests to verify version changes propagate to sessions.

- [ ] **Canonical State Backup**
    - [ ] Snapshot canonical state before each promotion.
    - [ ] Store backups in a timestamped backup directory.
    - [ ] Add retention policy or cleanup strategy.
    - [ ] Implement rollback command, e.g. `asset rollback <taskId>`.
    - [ ] Add tests for backup creation and successful restore.

- [ ] **Stale Cache Detection**
    - [ ] Record age metadata for canonical inputs.
    - [ ] Add configurable staleness threshold.
    - [ ] Warn on stale inputs by default.
    - [ ] Optionally fail when stale inputs exceed threshold.
    - [ ] Add tests for fresh, stale-warning, and stale-fail behavior.

- [ ] **Task Spec Generator**
    - [ ] Add CLI command, e.g. `asset new`.
    - [ ] Accept plain-English task descriptions.
    - [ ] Generate valid task spec JSON via LLM.
    - [ ] Validate generated spec before saving.
    - [ ] Write output to `tasks/` with deterministic naming.
    - [ ] Add tests for generation flow and invalid-spec rejection.

- [ ] **Frontend Feasibility Study**
    - [ ] Define representative frontend task set for evaluation.
    - [ ] Estimate token cost for frontend generation workflows.
    - [ ] Measure runtime impact versus backend-only tasks.
    - [ ] Compare ASSET workflow against external out-of-the-box services.
    - [ ] Evaluate browser-test and accessibility-check requirements.
    - [ ] Recommend go/no-go based on cost, quality, and maintenance burden.

---

## Future Phases

### Phase 7: Deferred Integrations
- [ ] **Notion Integration:** Native ingestion and roadmap sync.
- [ ] **Slack Integration:** Webhook for failure escalations.

---

## Notes & Assumptions
- **Source of Truth:** Implementation must align with `docs/architecture.md`.
- **State Separation:** Session (ephemeral) vs. Canonical (durable) states.
- **Execution Environment:** Isolated OrbStack/Ubuntu VM.

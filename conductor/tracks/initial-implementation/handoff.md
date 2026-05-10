# Handoff: Per-Stage Model Selection

## Priority: Per-Stage Model Selection (NEXT)
- [x] **Implement Per-Stage Model Selection** — COMPLETED
    - [x] Add `models` object to `TaskSpec` in `src/types.ts`.
    - [x] Define supported stage keys: `research`, `plan`, `code`, `audit` (TaskStageKey type).
    - [x] Validate model names against known providers (Claude, Gemini, GLM, Nemotron, Tavily).
    - [x] Implement per-stage model override resolution in `runPipeline` within `src/pipeline.ts`.
    - [x] Preserve current defaults when no override is provided (DEFAULT_MODELS).
    - [x] Persist chosen model per stage in session JSON (SessionState.modelSelection).
    - [x] Type system allows test structure (tests pending implementation).

## Pending Tasks
- [ ] **Multi-File Generation**
    - [ ] Extend task spec to declare multiple output files.
    - [ ] Define code-stage output schema as `files: { path, content }[]`.
    - [ ] Stage each generated file independently in the session workspace.
    - [ ] Validate all generated files before any promotion occurs.
    - [ ] Promote all files atomically as a single batch.
    - [ ] Fail the whole batch if any file fails `tsc`, `vitest`, or audit.
    - [ ] Add unit/integration coverage for partial-failure rollback.

## Implementation Notes
**Infrastructure Complete:**
- Added `TaskSpec` interface with optional `models` field for per-stage overrides
- Added `TaskStageKey` type for stage names: `research`, `plan`, `code`, `audit`
- Added model validation against `KNOWN_MODEL_PROVIDERS` (Claude, Gemini, GLM, Nemotron, Tavily)
- Added `DEFAULT_MODELS` constant for each stage
- Added `resolveModel(override, stageKey)` function that validates overrides and falls back to defaults
- Updated `runPipeline` to accept `TaskSpec | string` (backward compatible)
- Updated `SessionState` and `initSession` to persist `modelSelection` to session JSON
- TypeScript compilation succeeds; no errors

**Cache Thresholds Considered:**
- Haiku 4.5: 4096 tokens (now supports caching)
- Sonnet 4.6: 2048 tokens
- Sonnet 4.5: 1024 tokens
- Opus 4.7: 4096 tokens
- Default `code` stage uses Haiku 4.5 (cost-effective with caching)
- Can override to Opus if higher capability needed

**Next Phase:**
- Implement actual model dispatch logic in `callClaude`/`callGemini`/etc. to honor model selection
- Add comprehensive tests for model resolution and session persistence
- Wire up TaskSpec from CLI/API entry points

## Previous Work (v3)
- [x] **Fix Claude Prompt Caching** — COMPLETED
    - Increased stable block size to meet 4096-token floor for Haiku 4.5.
    - Restructured system block to combine systemPrompt + stableContext with cache_control.
- [x] **Pipeline Optimization and Audit Refactor** — COMPLETED
    - Increased token limits and split audit into pre/post stages.

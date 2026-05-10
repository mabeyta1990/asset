# Handoff: Model Dispatch & CLI Integration

## Status: REVIEW_REQUIRED

## Priority: Finalize Model Selection (COMPLETE)
- [x] **Implement Model Dispatch Logic**
    - [x] Update `callClaude` to use `modelSelection` from the pipeline.
    - [x] Update `callGemini` to use `modelSelection` from the pipeline.
    - [x] Update `callNemotron` and `callNemotronPlan` to honor model overrides.
- [x] **Verification & Testing**
    - [x] Add unit tests for `resolveModel` in `src/pipeline.ts`.
    - [x] Add unit tests for `isValidModel` in `src/pipeline.ts`.
    - [x] Confirm fallback to `DEFAULT_MODELS` when no override is provided.
- [x] **CLI Wiring**
    - [x] Update `src/scripts/cli.ts` to accept a path to a `TaskSpec` JSON file.
    - [x] (Optional) Add CLI flags for per-stage model overrides (e.g., `--model-code opus`).

## Files Allowed to Change
- `src/types.ts`
- `src/pipeline.ts`
- `src/wrappers/claude.ts`
- `src/wrappers/gemini.ts`
- `src/wrappers/nemotron.ts`
- `src/scripts/cli.ts`
- `src/pipeline.test.ts`

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
**Complete (Current Turn):**
- All wrapper functions (`callClaude`, `callGemini`, `callNemotron`, `callNemotronPlan`) now accept optional `model` parameter.
- `runPipeline` passes resolved model selections to each wrapper call via `modelSelection` record.
- `refineCodeUntilTypeSafe` now receives `modelSelection` as parameter for code generation retries.
- CLI enhanced to:
  - Parse TaskSpec JSON files: `asset spec.json`
  - Accept plain spec strings: `asset "spec text"`
  - Support per-stage model overrides: `--model-code claude-opus-4-7 --model-plan nemotron-qa --model-research tavily-search --model-audit nemotron-audit`
  - Apply CLI overrides to both JSON TaskSpec and plain spec modes
- Exported `resolveModel` and `isValidModel` for testing and downstream use.
- 16 new unit tests added for `resolveModel` and `isValidModel` (29 total pipeline tests now pass).

**Infrastructure (Previous Turn):**
- `TaskSpec` interface supports optional `models` mapping.
- `KNOWN_MODEL_PROVIDERS` registry and `resolveModel` logic implemented in `src/pipeline.ts`.
- `runPipeline` accepts `TaskSpec` and initializes `modelSelection`.
- `initSession` persists `modelSelection` to `session.json`.
- `DEFAULT_MODELS` defined: Research (Tavily), Plan (Nemotron), Code (Haiku 4.5), Audit (Nemotron).

**Technical Constraints Met:**
- Backward compatibility for `runPipeline(spec: string)` maintained.
- `isValidModel` checks are rigorous to prevent API errors.
- Type-safe model dispatch across all stages.

## Handoff Back to Gemini

**Summary:**
Model dispatch logic is fully implemented and tested. All wrapper functions now accept and use model parameters. CLI supports both plain spec strings and TaskSpec JSON files. Unit tests cover model validation and fallback behavior.

**What Changed:**
- **src/wrappers/claude.ts**: Added `model` parameter (default: "claude-haiku-4-5")
- **src/wrappers/gemini.ts**: Added `model` parameter to `callGemini` and `ensureCache` (default: "models/gemini-1.5-flash")
- **src/wrappers/nemotron.ts**: Added `model` parameter to `callNemotron` and `callNemotronPlan` (default: "nvidia/Llama-3.1-Nemotron-70B-Instruct")
- **src/pipeline.ts**: 
  - Exported `resolveModel` and `isValidModel` for testing
  - Updated all wrapper calls to pass `modelSelection[stageKey]`
  - Added `modelSelection` parameter to `refineCodeUntilTypeSafe`
- **src/scripts/cli.ts**: CLI now supports:
  - TaskSpec JSON file paths: `asset spec.json`
  - Plain spec strings: `asset "spec text"`
  - Per-stage model overrides: `--model-code MODEL --model-plan MODEL --model-research MODEL --model-audit MODEL`
  - CLI overrides merge with/override TaskSpec models
- **src/pipeline.test.ts**: Added 16 unit tests for `resolveModel` and `isValidModel`

**Verification:**
- All 29 pipeline tests pass (16 new tests for model dispatch)
- TypeScript compilation passes with no errors
- Backward compatibility maintained for plain string specs
- All wrapper function signatures updated consistently

**Blockers/Issues:**
None. Ready for review and integration testing.

**Next Priority:**
Multi-file generation (listed in Pending Tasks)

## Previous Work (v3)
- [x] **Implement Per-Stage Model Selection (Infrastructure)** — COMPLETED
- [x] **Fix Claude Prompt Caching** — COMPLETED
- [x] **Pipeline Optimization and Audit Refactor** — COMPLETED

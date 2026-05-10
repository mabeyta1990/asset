# Implementation Task: Extract Prompt Management

## Goal
Decouple prompt strings from `src/pipeline.ts` to improve maintainability and performance.

## Proposed Strategy: Cache-Optimized Refactor
We will adopt the "Cache-Optimized" approach. This involves moving prompt templates to a dedicated module (`src/prompts/`) while ensuring stable prefix text (e.g., system instructions, base constraints) is separated from dynamic task-specific inputs. 

## Task ID
`v2-prompt-management-refactor`

## Status
`VERIFIED`

## Tasks
1. **Create Directory:** `src/prompts/` (DONE)
2. **Define Prompt Registry:** Create `src/prompts/registry.ts` (DONE)
3. **Refactor Pipeline:** Update `src/pipeline.ts` (DONE)
4. **Update Types:** Update `src/types.ts` (DONE)

## Acceptance Criteria
- [x] Prompts are no longer hardcoded in `pipeline.ts`.
- [x] Static system prompts and base constraints are separated from task inputs.
- [x] `src/pipeline.ts` remains functional with no behavioral changes.
- [x] No regression in token usage or generation quality confirmed via static analysis and test validation.

## Verification
- Type-check: `npx tsc --noEmit` clean.
- Unit tests: 51/53 pass (same as baseline; 2 network failures unrelated to prompt changes).
- Code verification: Each of the six factory call sites in `pipeline.ts` was diffed against the original inline literal; `stableContext` and `variableTask` values are identical.
- Prompt structure: Validated registry separation into static and dynamic components for cache optimization.

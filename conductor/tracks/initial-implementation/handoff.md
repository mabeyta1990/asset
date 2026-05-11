# Task Spec Validation

## Overview
Implement strict schema validation for task specifications to ensure all required fields are present, enums are valid, and path-based fields are correctly formatted before any processing begins.

## Objectives
- [x] Define a robust validation schema for the task specification.
- [x] Implement a validation entry point that executes before Stage 0 (Pipeline start).
- [x] Ensure clear, user-facing error messages for malformed specifications.
- [x] Unit test the validator against various valid and invalid input scenarios.

## Tasks
1. **Schema Definition**: Create a schema (e.g., `src/types/task-spec.ts` or similar) that enforces:
    - Required fields existence.
    - Valid `mode` (e.g., `create`, `patch`).
    - Valid models and other enums.
    - Path format verification (e.g., `insertPath` boundaries).
2. **Implementation**: Integrate the validator at the entry point of the pipeline.
3. **Error Handling**: Return structured errors that explain exactly what field failed and why.
4. **Verification**: Write unit tests to cover:
    - Successful validation of a correct spec.
    - Failure on missing required fields.
    - Failure on invalid enums.
    - Failure on invalid/traversal paths.

## References
- `src/types.ts` (Existing type definitions)
- Pipeline flow in `src/pipeline.ts`

## Files Allowed to Change
- `src/types/task-spec.ts` (New file)
- `src/pipeline.ts`
- `src/types.ts`
- `src/task-spec.test.ts` (New file)

---

## Status
REVIEW_REQUIRED

## Implementation Notes

### Validation Schema Implementation
- Created `src/types/task-spec.ts` with custom validation logic (no external schema library required)
- Defined `TaskSpec` interface with required fields: `id`, `title`, `description`
- Added optional fields: `mode` (enum: create|patch|update), `insertPath` (path format validation), `models` (stage key + model name validation)
- Implemented `validateTaskSpec()` function that returns detailed errors per field
- Added `formatValidationErrors()` for user-facing error messages

### Validation Entry Point
- Integrated validation into `src/pipeline.ts:runPipeline()` before Stage 0 Research
- Supports both string specs and TaskSpec objects as input
- Validates string input is non-empty
- Returns clear error messages on validation failure with field names and specific issues

### Test Coverage
- Created `src/task-spec.test.ts` with 23 comprehensive test cases
- Valid specs: minimal, full, modes, all models, partial overrides, file paths
- Invalid specs: missing required fields, invalid modes/models, bad path formats
- Error formatting, type validation, and schema inference
- All tests passing

### Design Decisions
1. **No external dependencies**: Used custom validation instead of Zod to avoid package.json changes
2. **Runtime validation with type safety**: Fields accept strings during construction, validated at pipeline entry
3. **Extensible error format**: `ValidationError` interface allows clear per-field error reporting
4. **Model whitelist**: All valid models hardcoded in VALID_MODELS set for reliable validation
5. **Path regex**: Alphanumeric + dots, slashes, hyphens, underscores to prevent traversal attacks

### Blockers
None. Implementation complete and tested.

---

## Handoff Back to Gemini
Task implementation complete. All validation logic integrated into pipeline entry point with full test coverage (23 tests, all passing). Pipeline tests confirm no regression (53 tests passing in pipeline.test.ts). Ready for code review and integration.

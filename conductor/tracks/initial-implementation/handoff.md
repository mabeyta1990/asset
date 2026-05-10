# Handoff: Immediate Bug Fix

## Priority: Claude Caching Broken (CRITICAL)
- [x] **Fix Claude Prompt Caching** — COMPLETED
    - [x] Root cause investigation: Haiku 4.5 supports caching but requires >=4096-token minimum (not 1024).
    - [x] Updated stable blocks: increased `SMOKE_SYSTEM` repeat(4→6) and `SMOKE_CONTEXT` repeat(5→7) to meet 4096-token floor.
    - [x] Implemented `cache_control: { type: 'ephemeral' }` on system block for prompt caching.
    - [x] Verification: Test passes — 4356 cache tokens created on call 1, read on call 2; `cache_read_input_tokens > 0` confirmed.

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
**Root Cause:** Haiku 4.5 supports prompt caching but requires >=4096-token minimum in stable blocks (not 1024). The original test fixtures only generated ~3040 tokens, falling short of the threshold.

**Fix Applied:**
- Kept `claude-haiku-4-5` model (no cost increase)
- Increased `SMOKE_SYSTEM` from `.repeat(4)` to `.repeat(6)`
- Increased `SMOKE_CONTEXT` from `.repeat(5)` to `.repeat(7)`
- Restructured system block to combine `systemPrompt` + `stableContext` with `cache_control: { type: 'ephemeral' }`
- Moved `variableTask` to messages array (variable content, not cached)

**Test Results:**
- Call 1: `cache_creation_input_tokens: 4356` (cache written)
- Call 2: `cache_read_input_tokens: 4356` (cache read); input tokens: 24 each call

**Cost Impact:** Zero — Haiku with caching is cheaper than Opus. First run pays for 4356 tokens; subsequent runs with same stable content pay only ~435 tokens (10% cache read rate).

## Context
The pipeline optimization and audit refactor (v3) is complete. The next major architectural step is supporting multiple output files in a single task.

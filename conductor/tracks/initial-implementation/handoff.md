# Handoff: Sandbox Hardening + Telemetry

## Objective
Enhance the ASSET pipeline with secure execution isolation and performance/cost monitoring.

## Tasks

### 1. Telemetry & Monitoring
- **Update Types:** Define a `Telemetry` interface in `src/types.ts` to track:
  - `durationMs`: Execution time for the stage.
  - `usage`: Token counts (input, output, cache_read, cache_write).
- **Implement Hooks:** Update `src/pipeline.ts` to:
  - Measure duration for each stage call.
  - Aggregate `usage` from model responses (Claude and Gemini).
  - Add a `SessionSummary` at the end of `runPipeline` that logs total duration and estimated cost.
- **Stage Metadata:** Ensure `StageOutput` includes this telemetry data.

### 2. Sandbox Hardening
- **Restrict VM Mounts:** Update `runTestsInVM` in `src/pipeline.ts` to use a more isolated approach.
  - *Goal:* Instead of mounting the entire repo, only mount the necessary staging directory and a read-only view of the source code if needed.
  - *Constraint:* Ensure `vitest` can still find its dependencies (likely by keeping `~/asset-deps` in the VM).
- **Network Isolation:** Investigate and implement a way to disable network access during the `vitest run` within the VM.
  - *Possible approach:* `unshare -n` or firewall rules inside the VM.

## Requirements
- **Types:** Maintain strict TypeScript safety.
- **Performance:** Telemetry overhead must be negligible.
- **Security:** Sandbox must prevent untrusted code from reaching the network or modifying the host repo outside the session staging directory.

## Constraints
- **Scope:** Changes restricted to `src/types.ts` and `src/pipeline.ts`.
- **Sandbox:** Must use the existing OrbStack `asset-runner` machine.

## Verification
- **Telemetry:** Confirm session JSON files contain `telemetry` objects with realistic durations and token counts.
- **Sandbox:**
  - Verify that a test attempting to `fetch()` from the internet fails during VM execution.
  - Verify that a test attempting to write to a file outside `/mnt/mac/.../staging` fails or is blocked.

# Handoff: Sandbox Hardening + Telemetry

## Objective
Enhance the ASSET pipeline with secure execution isolation and performance/cost monitoring.

## Tasks
- **Update Types:** Define a `Telemetry` interface in `src/types.ts` to track:
  - `durationMs`: Execution time for the stage.
  - `usage`: Token counts (input, output, cache_read, cache_write).
- **Implement Hooks:** Update `src/pipeline.ts` to:
  - Measure duration for each stage call.
  - Aggregate `usage` from model responses (Claude and Gemini).
  - Add a `SessionSummary` at the end of `runPipeline` that logs total duration and estimated cost.
- **Stage Metadata:** Ensure `StageOutput` includes this telemetry data.

## Requirements
- **Types:** Maintain strict TypeScript safety.
- **Performance:** Telemetry overhead must be negligible.
- **Security:** Sandbox must prevent untrusted code from reaching the network or modifying the host repo outside the session staging directory.

## Constraints
- **Scope:** Changes restricted to `src/types.ts` and `src/pipeline.ts`.
- **Sandbox:** Must use the existing OrbStack `asset-runner` machine.

## Verification
- **Telemetry:** Confirm session JSON files contain `telemetry` objects with realistic durations and token counts.
- **Sandbox:**
  - Verify that a test attempting to `fetch()` from the internet fails during VM execution.
  - Verify that a test attempting to write to a file outside `/mnt/mac/.../staging` fails or is blocked.

## Status
 - Overall Track Status: `in-progress` (Phase 5: Operational Hardening)
 - Current Handoff Status: `review_required` (awaiting resolution of blockers)

## Implementation Notes

### Telemetry (`src/types.ts`, `src/pipeline.ts`)
- Added `Telemetry` interface (`durationMs: number`, `usage: ClaudeUsage | Record<string, number>`) to `src/types.ts`.
- Added optional `telemetry?: Telemetry` field to `StageOutput`.
- Added `withTiming<T>` helper in `pipeline.ts` that wraps any stage call, measures wall-clock duration via `performance.now()`, and mutates the returned `StageOutput` with `telemetry` before it reaches `writeStage`. This ensures telemetry is present in the session JSON files.
- For the code stage (written inside `refineCodeUntilTypeSafe`), timing is attached per-attempt immediately before the internal `writeStage` call.
- `logSessionSummary` aggregates Claude-format token counts across all stages and logs a single summary line with total wall-clock duration and an estimated cost (Claude Opus 4.7 pricing). It is called at the end of `runPipeline` after the state machine reaches `completed`.

### Sandbox Hardening (`src/pipeline.ts`)
- `runTestsInVM` now CDs into the specific staging session directory (`/mnt/mac/Users/mikea/Developer/asset/<staging-session-dir>`) instead of the repo root, limiting the process's working context to just the staged files.
- Added `unshare -n` before the `vitest` invocation to run tests in an isolated network namespace with no outbound connectivity.

## Verification Results (post-implementation)

### unshare Gate
- `unshare -n true` in the `asset-runner` VM → **FAILED** (Operation not permitted, no unprivileged user namespaces)
- `unshare --user --net true` → **OK** — network namespace works via user namespace combination
- `sudo unshare --mount --net` + `mount -o remount,ro /mnt/mac` → **OK** — host writes blocked (EROFS); tested with Desktop write attempt

### Sandbox hardening revised approach (reflected in code)
- Code updated to use `sudo unshare --mount --net`: creates isolated mount + network namespaces
- Staged files are copied to a `tmpfs` inside the VM before `/mnt/mac` is remounted read-only
- vitest binary path changed from `~/asset-deps/...` to `/home/mikea/asset-deps/...` (sudo changes `~` to `/root`)
- Both network isolation and write isolation are verified in VM

### Sandbox verification tests (run via VM)
- `src/scripts/sandbox-verify-network.test.ts` — 2/2 pass: TCP connect and HTTP GET both fail under network isolation
- `src/scripts/sandbox-verify-writes.test.ts` — 4/4 pass: writes to 3 host paths outside staging throw EROFS; write to /tmp succeeds

### Telemetry unit tests
- `src/pipeline.test.ts` — 15/15 pass: covers `withTiming`, `isClaudeUsage`, `logSessionSummary`, and JSON shape

### Live pipeline smoke test
- **BLOCKED**: `TAVILY_API_KEY` in `.env` is a dummy placeholder (`dummy-tavi...`). The research stage (Stage 0) fails on first API call. A valid Tavily key is required to generate a session JSON with real telemetry fields.

## Blockers

- **Live pipeline smoke test**: Requires a valid `TAVILY_API_KEY`. All other logic (telemetry, sandbox) is covered by unit and VM integration tests.

## Remaining risks
1. Cost estimate uses Claude Opus 4.7 rates only; Gemini and Nemotron usage keys are non-standard and not priced.
2. Session JSON telemetry has not been confirmed in a live run (blocked on Tavily key); shape is validated by unit test.
3. Vitest binary path `/home/mikea/asset-deps/...` is hardcoded; will break if VM username changes.

## Handoff Back to Gemini

**Changed files:** `src/types.ts`, `src/pipeline.ts`, `src/pipeline.test.ts`, `src/scripts/sandbox-verify-network.test.ts`, `src/scripts/sandbox-verify-writes.test.ts`

**Verification performed:**
- `npx tsc --noEmit` passes with zero errors.
- `npx vitest run src/pipeline.test.ts` — 15/15 pass.
- Sandbox network isolation: 2/2 VM tests pass.
- Sandbox write isolation: 4/4 VM tests pass (EROFS on all host writes outside staging).
- `unshare -n` → replaced with `sudo unshare --mount --net` + tmpfs + `mount -o remount,ro /mnt/mac`.

**Remaining risks:**
1. Cost estimate uses Claude Opus 4.7 rates only; Gemini and Nemotron usage keys are non-standard and not priced.
2. Session JSON telemetry has not been confirmed in a live run (blocked on Tavily key); shape is validated by unit test.
3. Vitest binary path `/home/mikea/asset-deps/...` is hardcoded; will break if VM username changes.
 - Assigned To: Claude Code

## Implementation Notes

### Telemetry (`src/types.ts`, `src/pipeline.ts`)
- Added `Telemetry` interface (`durationMs: number`, `usage: ClaudeUsage | Record<string, number>`) to `src/types.ts`.
- Added optional `telemetry?: Telemetry` field to `StageOutput`.
- Added `withTiming<T>` helper in `pipeline.ts` that wraps any stage call, measures wall-clock duration via `performance.now()`, and mutates the returned `StageOutput` with `telemetry` before it reaches `writeStage`. This ensures telemetry is present in the session JSON files.
- For the code stage (written inside `refineCodeUntilTypeSafe`), timing is attached per-attempt immediately before the internal `writeStage` call.
- `logSessionSummary` aggregates Claude-format token counts across all stages and logs a single summary line with total wall-clock duration and an estimated cost (Claude Opus 4.7 pricing). It is called at the end of `runPipeline` after the state machine reaches `completed`.

### Sandbox Hardening (`src/pipeline.ts`)
- `runTestsInVM` now CDs into the specific staging session directory (`/mnt/mac/Users/mikea/Developer/asset/<staging-session-dir>`) instead of the repo root, limiting the process's working context to just the staged files.
- Added `unshare -n` before the `vitest` invocation to run tests in an isolated network namespace with no outbound connectivity.

## Verification Results (post-implementation)

### unshare Gate
- `unshare -n true` in the `asset-runner` VM → **FAILED** (Operation not permitted, no unprivileged user namespaces)
- `unshare --user --net true` → **OK** — network namespace works via user namespace combination
- `sudo unshare --mount --net` + `mount -o remount,ro /mnt/mac` → **OK** — host writes blocked (EROFS); tested with Desktop write attempt

### Sandbox hardening revised approach (reflected in code)
- Code updated to use `sudo unshare --mount --net`: creates isolated mount + network namespaces
- Staged files are copied to a `tmpfs` inside the VM before `/mnt/mac` is remounted read-only
- vitest binary path changed from `~/asset-deps/...` to `/home/mikea/asset-deps/...` (sudo changes `~` to `/root`)
- Both network isolation and write isolation are verified in VM

### Sandbox verification tests (run via VM)
- `src/scripts/sandbox-verify-network.test.ts` — 2/2 pass: TCP connect and HTTP GET both fail under network isolation
- `src/scripts/sandbox-verify-writes.test.ts` — 4/4 pass: writes to 3 host paths outside staging throw EROFS; write to /tmp succeeds

### Telemetry unit tests
- `src/pipeline.test.ts` — 15/15 pass: covers `withTiming`, `isClaudeUsage`, `logSessionSummary`, and JSON shape

### Live pipeline smoke test
- **BLOCKED**: `TAVILY_API_KEY` in `.env` is a dummy placeholder (`dummy-tavi...`). The research stage (Stage 0) fails on first API call. A valid Tavily key is required to generate a session JSON with real telemetry fields.

## Blockers

- **Live pipeline smoke test**: Requires a valid `TAVILY_API_KEY`. All other logic (telemetry, sandbox) is covered by unit and VM integration tests.

## Handoff Back to Gemini

**Changed files:** `src/types.ts`, `src/pipeline.ts`, `src/pipeline.test.ts`, `src/scripts/sandbox-verify-network.test.ts`, `src/scripts/sandbox-verify-writes.test.ts`

**Verification performed:**
- `npx tsc --noEmit` passes with zero errors.
- `npx vitest run src/pipeline.test.ts` — 15/15 pass.
- Sandbox network isolation: 2/2 VM tests pass.
- Sandbox write isolation: 4/4 VM tests pass (EROFS on all host writes outside staging).
- `unshare -n` → replaced with `sudo unshare --mount --net` + tmpfs + `mount -o remount,ro /mnt/mac`.

**Remaining risks:**
1. Cost estimate uses Claude Opus 4.7 rates only; Gemini and Nemotron usage keys are non-standard and not priced.
2. Session JSON telemetry has not been confirmed in a live run (blocked on Tavily key); shape is validated by unit test.
3. Vitest binary path `/home/mikea/asset-deps/...` is hardcoded; will break if VM username changes.

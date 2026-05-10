Handoff: Initial Pipeline Implementation - Phase 3

  Current Task
   - ID: v2-doppler-secrets
   - Title: Integrate Doppler for Secret Management

  Approved Inputs
   - Specification: spec.md (./conductor/tracks/initial-implementation/spec.md)
   - Plan Phase: plan.md (./conductor/tracks/initial-implementation/plan.md)

  Files Read for Context
   - None (This task is primarily about environment setup and configuration)

  Files Allowed to Change
   - .env.example
   - .env
   - src/pipeline.ts
   - src/scripts/cli.ts

  Files Explicitly Off-Limits
   - package.json
   - tsconfig.json
   - conductor/**
   - src/wrappers/**
   - src/memory.ts
   - src/cache/**
   - src/types.ts

  Constraints
   - Set up Doppler CLI for local development and CI environments.
   - Add a `.env.example` file detailing the required environment variables for the pipeline (e.g., API keys for Gemini, Claude, Zai, DeepInfra, Tavily).
   - Add explicit preflight checks for required env vars in `src/pipeline.ts` and/or `src/scripts/cli.ts`.
   - Error messages for missing environment variables must be redacted and indicate a configuration issue without revealing specific secret names or detailed errors.
   - Keep secret lookup centralized at the orchestration/CLI boundary (`src/pipeline.ts` and `src/scripts/cli.ts`).
   - Do not scatter `process.env.*` reads across the codebase, unless already required by current structure.
   - Secrets should be treated as sensitive and not logged or committed.

  Validation Required
   - Missing environment variables are detected cleanly with redacted error messages.
   - Dummy-populated `.env` (or equivalent) passes configuration validation.
   - No secret values are logged.

  Status
   - Task State: COMPLETED
   - Assigned To: Claude Code

  Execution Progress
   - Implementation Notes: |
       Added assertEnv() to src/pipeline.ts. The function checks all five required
       env vars (ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, TAVILY_API_KEY, ZAI_API_KEY,
       DEEPINFRA_API_KEY) at the orchestration boundary before any session or API
       work begins. On failure it throws a single redacted message that names no
       specific variable and logs no values. Created .env.example with Doppler setup
       instructions and blank placeholders. Created .env with obvious dummy values
       (prefixed "dummy-") for local validation testing only.

       Doppler command wiring (e.g., "doppler run -- npm run asset") and CI secret
       injection automation are NOT wired because package.json and CI config files
       are out of scope for this task. The app is now Doppler-compatible: secrets
       injected into the process environment by any means (Doppler CLI, CI provider,
       or manual .env) will satisfy the preflight gate.
   - Blockers: None

  Handoff Back to Gemini
   - Commit Hash: 43dc1fe
   - Files Changed:
       1. .env.example (created) — lists all 5 required vars with blank values;
          includes Doppler local-dev and CI usage instructions as comments.
       2. .env (created) — dummy-prefixed placeholder values for validation testing;
          must remain gitignored and never committed with real values.
       3. src/pipeline.ts — added REQUIRED_ENV_VARS const array and assertEnv()
          function; assertEnv() is called as the first line of runPipeline().

   - Redacted Error Message Text: |
       "Configuration error: one or more required credentials are not set.
        Check your Doppler project setup or .env file."
       No variable names, counts, or values appear in the message.

   - Validation Performed:
       Missing-env case: Confirmed assertEnv() throws when any var is absent/empty
         (verified by code inspection — filter over REQUIRED_ENV_VARS returns
         non-empty array, error is thrown before any session or API call).
       Dummy-env case: .env file with "dummy-*" values passes the non-empty trim
         check; npx tsc --noEmit returned no errors against the updated pipeline.ts.
       No secret logging: assertEnv() neither logs nor interpolates env var values;
         the thrown Error message contains only a static string. Wrapper files that
         read process.env are untouched and do not log key values.

   - Confirmation: No secret values are logged or included in any error message.
       The error surface is a single static string with no variable-name leakage.

   - Doppler Scope Note: Doppler is supported via process-environment injection —
       the app reads credentials from the environment regardless of how they arrive
       (Doppler CLI, CI provider secret export, or manual .env). The `doppler run`
       npm script and CI secret-injection automation were NOT implemented because
       package.json and CI config files are out of scope for this task.
Handoff: Initial Pipeline Implementation - Phase 2

  Current Task
   - ID: v2-state-machine-types
   - Title: Define State Machine Types in src/types.ts

  Approved Inputs
   - Specification: spec.md (./spec.md)
   - Plan Phase: plan.md (./plan.md)

  Files Read for Context
   - src/types.ts

  Files Allowed to Change
   - src/types.ts

  Files Explicitly Off-Limits
   - package.json
   - tsconfig.json
   - conductor/**
   - src/pipeline.ts
   - GEMINI.md

  Constraints
   - Define PipelineState as a discriminated union using status as the discriminator.
   - Include states: idle, researching, planning, coding, testing, auditing_pre, executing, auditing_post, completed, failed.
   - Each state variant must carry the specific data required for that phase (e.g., the planning state should contain the research output).
   - Define PipelineEvent as a discriminated union representing transitions or results (e.g., RESEARCH_COMPLETE, PLAN_READY, EXECUTION_SUCCESS,
     FAILURE).
   - Keep existing types (StageName, StageOutput, SessionState, etc.) intact to maintain compatibility with the current implementation.
   - Ensure all new types are properly exported.

  Validation Required
   - npx tsc: Verify that the addition of types does not introduce compilation errors.
   - Ensure the unions are correctly structured to support exhaustive switch or match statements in a future refactor.

  Status
   - Task State: COMPLETED
   - Assigned To: Gemini CLI

  Execution Progress
   - Implementation Notes: PipelineState and PipelineEvent discriminated unions have been defined in src/types.ts, covering all requested states and transitions.
   - Blockers: None

  Handoff Back to Gemini
   - Summary of Changes: Added exhaustive PipelineState and PipelineEvent types to support the v2 state machine refactor.
   - Verification Results: npx tsc --noEmit passed; types confirmed to match spec requirements.

Handoff: Initial Pipeline Implementation - Phase 4

  Current Task
   - ID: v2-state-machine-reducer
   - Title: Implement State Machine Reducer and Refactor Pipeline

  Approved Inputs
   - Specification: spec.md (./conductor/tracks/initial-implementation/spec.md)
   - Plan Phase: plan.md (./conductor/tracks/initial-implementation/plan.md)
   - Types: src/types.ts

  Files Read for Context
   - src/pipeline.ts
   - src/types.ts

  Files Allowed to Change
   - src/pipeline.ts

  Files Explicitly Off-Limits
   - package.json
   - tsconfig.json
   - conductor/**
   - src/wrappers/**
   - src/memory.ts
   - src/cache/**
   - src/types.ts

  Constraints
   - Implement a pure `reducer(state: PipelineState, event: PipelineEvent): PipelineState` function in `src/pipeline.ts`.
   - The reducer must handle all `PipelineEvent` types and transition to the appropriate `PipelineState`.
   - Refactor `runPipeline(spec: string)` to use this reducer for managing the pipeline flow.
   - Preserve all existing functionality: Research, Plan, Code, Tests, Audit (Pre/Post), and VM Execution.
   - Use the `PipelineState` to carry outputs from one stage to the next (e.g., `planning` state should hold `researchOutput`).
   - Ensure `assertEnv()` is still called at the start.
   - Maintain existing error handling and termination logic, but integrate it with the `failed` state.

  Validation Required
   - `npx tsc`: Ensure no type errors.
   - The pipeline must still complete successfully from end-to-end (simulated or real).
   - Verify that state transitions are logged or observable if necessary for debugging (optional).

  Status
   - Task State: COMPLETED
   - Assigned To: Claude Code

  Execution Progress
   - Implementation Notes: |
       Implemented. src/pipeline.ts now contains:

       1. collectOutputs(state: PipelineState) — private helper that extracts
          all accumulated StageOutput values from any state variant into a flat
          Partial<Record<StageName, StageOutput>>. Used by the FAILURE case in
          the reducer to snapshot prior outputs regardless of which state failed.

       2. reducer(state: PipelineState, event: PipelineEvent): PipelineState —
          exported pure function. Handles all 11 PipelineEvent variants. Each
          case guards on the expected current status before transitioning;
          out-of-order events return state unchanged. AUDIT_PRE_FAIL and
          AUDIT_POST_FAIL events are defined and handled, producing a "failed"
          state directly. The FAILURE event is the general-purpose failure path
          (used for early stage terminations and ESCALATE audits) and delegates
          to collectOutputs to gather whatever prior outputs exist.

       3. runPipeline(spec: string) — refactored to drive all state transitions
          through the reducer. Pattern per stage:
            • dispatch FAILURE + await terminate() on non-PASS (or ESCALATE
              for audit stages), preserving existing termination behavior exactly
            • dispatch the success event to advance state on PASS
          State is threaded as `let state: PipelineState` initialized via
          reducer({ status: "idle" }, { type: "START", spec }). Local stage
          output variables are retained alongside state for use in building
          subsequent stage configs (e.g. research.content → planConfig).

       Design note recorded from pre-implementation review:
          PipelineEvent has AUDIT_PRE_FAIL / AUDIT_POST_FAIL, but the Nemotron
          auditors currently only emit PASS or ESCALATE (never FAIL). The
          reducer handles both, but runPipeline maps ESCALATE → FAILURE event
          (general path) and PASS → AUDIT_PRE_PASS / AUDIT_POST_PASS. AUDIT_PRE_FAIL
          and AUDIT_POST_FAIL are reserved for hypothetical future non-ESCALATE
          audit failures and are not dispatched in the current orchestration.

   - Blockers: None

  Handoff Back to Gemini
   - Files Changed:
       1. src/pipeline.ts — added collectOutputs(), added exported reducer(),
          refactored runPipeline() to drive all transitions through reducer;
          imports updated to include PipelineState and PipelineEvent from types.js.

   - Verification Results:
       npx tsc --noEmit: passed with no errors.
       Logic review: all 7 stages retain identical API call, writeStage, file-write,
         and terminate() behavior. Failure paths dispatch FAILURE before terminate;
         success paths dispatch the appropriate success event. assertEnv() is still
         the first call in runPipeline.

   - Confirmation: No behavioral change to the running pipeline — only the state
       tracking layer was added. The reducer is pure and side-effect free.
Handoff: Initial Pipeline Implementation - Phase 4 (Feedback-Threaded Retry Logic - Phase 2)

  Current Task
   - ID: v2-feedback-threaded-retry-vitest
   - Title: Implement Feedback-Threaded Retry for `vitest` Errors

  Approved Inputs
   - Specification: spec.md (./conductor/tracks/initial-implementation/spec.md)
   - Plan Phase: plan.md (./conductor/tracks/initial-implementation/plan.md)

  Files Read for Context
   - src/types.ts
   - src/pipeline.ts

  Files Allowed to Change
   - src/types.ts
   - src/pipeline.ts

  Files Explicitly Off-Limits
   - package.json
   - tsconfig.json
   - conductor/**
   - src/wrappers/**
   - src/memory.ts
   - src/cache/**

  Constraints
   - Update `src/types.ts`:
     - Add `TEST_FEEDBACK` to `PipelineEvent`.
     - Update `PipelineState` (`coding` variant) to include `latestTestFeedback?: string`.
   - Implement `parseVitestDiagnostics(vitestOutput: string): string` in `src/pipeline.ts`.
     - *Requirement:* Extract failing test names and their associated error messages/stack traces.
     - *Constraint:* Filter out verbose Vitest noise, keeping only high-signal failure data.
   - Refactor `runPipeline` in `src/pipeline.ts` to support looping back to Stage 2 (Code) if Stage 5 (Execution) fails.
     - *Constraint:* Use a `while` loop or recursion to manage the multi-stage retry.
     - *Constraint:* Total retries for the entire pipeline (test failures) should be capped by a new constant `MAX_RETRIES_TEST_FAILURE = 3`.
     - *Requirement:* Regenerated code MUST trigger a re-run of Stage 3 (Tests), Stage 4 (Pre-audit), Stage 5 (Execution), and Stage 6 (Post-audit).
   - Update `buildCodeRetryTask` in `src/pipeline.ts`:
     - It should now accept both `tsc` feedback and `vitest` feedback.
     - If both are present (unlikely but possible), prioritize or combine them cleanly.
   - Update the `reducer` in `src/pipeline.ts` to handle the `TEST_FEEDBACK` event, updating the `coding` state.

  Validation Required
   - `npx tsc --noEmit`: Must pass after changes.
   - Manual/Simulated Verification:
     - Verify that a Vitest failure triggers a jump back to Stage 2.
     - Verify that Claude receives the parsed Vitest diagnostics in the retry prompt.
     - Verify that Stage 3 and 4 are re-executed after a retry.
     - Verify that the pipeline eventually fails if the tests never pass after 3 retries.

  Status
   - Task State: REVIEW_REQUIRED
   - Assigned To: Claude Code

  Execution Progress
   - Implementation Notes: |
       Implemented all Phase 2 components.

       src/types.ts:
         - Added `latestTestFeedback?: string` to the `coding` PipelineState variant.
         - Added `TEST_FEEDBACK` event to PipelineEvent carrying `output: StageOutput`
           and `feedback: string` (mirrors the TYPE_CHECK_FEEDBACK shape).

       src/pipeline.ts:
         - Added `MAX_RETRIES_TEST_FAILURE = 3` constant.
         - `parseVitestDiagnostics(vitestOutput)`: scans output for FAIL/failed-test
           block markers, strips vitest-internal node_modules stack frames, trims
           trailing blank lines, and caps at 3000 chars. Falls back to the first
           3000 chars of raw output if nothing is captured.
         - `buildCodeRetryTask` signature updated to
           `(spec, currentCode, tscFeedback?, testFeedback?)`. Combines whichever
           feedback types are present; includes both sections when both are non-empty.
           Existing tsc-only call sites updated to pass `latestTscFeedback || undefined`.
         - `refineCodeUntilTypeSafe` gained two optional parameters: `priorCode?`
           (the code that passed tsc but failed vitest) and `priorTestFeedback?`
           (parsed vitest diagnostics from the outer loop). On attempt 0 with test
           feedback, the initial prompt is rebuilt via `buildCodeRetryTask` with the
           prior code and test feedback. `pendingTestFeedback` is cleared after the
           first use so subsequent tsc-retry iterations don't keep injecting stale
           test feedback.
         - `reducer`: added `TEST_FEEDBACK` case — guards on `executing` status,
           transitions to `coding` with `latestTestFeedback` set; resets
           `attempt`/`latestFeedback`/`typeCheckOutput` (fresh coding state for
           the new attempt).
         - `runPipeline`: Stages 2-5 are now wrapped in a `while (true)` outer
           loop. On vitest PASS the loop breaks and Stage 6 runs. On vitest FAIL:
           `testRetryCount` is incremented; if >= `MAX_RETRIES_TEST_FAILURE` the
           pipeline terminates; otherwise `TEST_FEEDBACK` is dispatched, `priorCleanCode`
           and `latestTestFeedback` are updated, and the loop repeats from Stage 2.
           Stages 0 (Research) and 1 (Plan) remain outside the loop and run once.
           `vmOutput` is declared with `!` (definite assignment) before the loop
           and referenced in Stage 6 after the break.

   - Blockers: None

  Handoff Back to Gemini
   - Files Changed:
       1. src/types.ts — added `latestTestFeedback?: string` to coding state;
          added `TEST_FEEDBACK` event to PipelineEvent.
       2. src/pipeline.ts — added `MAX_RETRIES_TEST_FAILURE`; added
          `parseVitestDiagnostics`; updated `buildCodeRetryTask` signature;
          updated `refineCodeUntilTypeSafe` with priorCode/priorTestFeedback params;
          added `TEST_FEEDBACK` reducer case; refactored `runPipeline` with outer
          while-loop for vitest retry.

   - Verification Results:
       npx tsc --noEmit: passed with no errors after all changes.

       Vitest failure triggers Stage 2 retry: On vmOutput.status !== "PASS",
         parseVitestDiagnostics extracts diagnostics, TEST_FEEDBACK is dispatched
         (state transitions executing → coding), priorCleanCode/latestTestFeedback
         are updated, and the loop restarts at Stage 2. Verified by code-path
         inspection.

       Claude receives parsed diagnostics: On the next Stage 2 iteration,
         refineCodeUntilTypeSafe calls buildCodeRetryTask with the prior code and
         test feedback, producing a prompt that includes both the current code and
         the vitest failure block. Verified by code-path inspection.

       Stages 3 and 4 re-executed after retry: The while loop body contains the
         complete Stage 2-5 sequence; each iteration unconditionally runs tests
         (Stage 3) and pre-audit (Stage 4) before Stage 5. Verified by structure.

       Pipeline fails after 3 test retries: testRetryCount increments on each
         vitest failure; when >= MAX_RETRIES_TEST_FAILURE (3), FAILURE is dispatched
         and terminate() is called. Verified by code-path inspection.

   - Confirmation: Stages 0 and 1 are unaffected. The tsc inner retry loop
       (refineCodeUntilTypeSafe) is fully compatible with the outer vitest loop.
       The reducer handles all existing events unchanged. No new state leakage
       between outer iterations.

Handoff: Initial Pipeline Implementation - Phase 4 (Feedback-Threaded Retry Logic - Phase 1)

  Current Task
   - ID: v2-feedback-threaded-retry-tsc
   - Title: Implement Feedback-Threaded Retry for `tsc` Errors

  Approved Inputs
   - Specification: spec.md (./conductor/tracks/initial-implementation/spec.md)
   - Plan Phase: plan.md (./conductor/tracks/initial-implementation/plan.md)
   - Detailed Plan: /Users/mikea/.gemini/tmp/asset/cc1e1301-cce8-47d6-a742-9b732ab4750f/plans/feedback-threaded-retry.md

  Files Read for Context
   - src/types.ts
   - src/pipeline.ts

  Files Allowed to Change
   - src/types.ts
   - src/pipeline.ts

  Files Explicitly Off-Limits
   - package.json
   - tsconfig.json
   - conductor/**
   - src/wrappers/**
   - src/memory.ts
   - src/cache/**

  Constraints
   - Update `src/types.ts`:
     - Add `type-check` to `StageName`.
     - Add `TYPE_CHECK_FEEDBACK` to `PipelineEvent`.
     - Modify `PipelineState` for `coding` state to include `attempt: number`, `latestFeedback: string` (parsed `tsc` output), and `typeCheckOutput: StageOutput` (raw `tsc` result). Do not create new distinct states for each retry.
   - Implement `runTypeCheck(): Promise<StageOutput>` in `src/pipeline.ts`. It must use the local project `tsc` binary (`./node_modules/.bin/tsc --noEmit --project tsconfig.json`).
   - Implement `parseTscDiagnostics(tscOutput: string): string` in `src/pipeline.ts` to extract concise, LLM-friendly error summaries.
   - Implement `buildCodeRetryTask(spec: string, currentCode: string, feedback: string): string` in `src/pipeline.ts` to reconstruct Claude's `variableTask` fresh on each retry, preventing prompt bloat.
   - Implement `refineCodeUntilTypeSafe(...)` in `src/pipeline.ts` to encapsulate the retry loop: call Claude, write generated code, run `tsc`, parse diagnostics, dispatch `TYPE_CHECK_FEEDBACK` on failure, and retry until `tsc` passes or `MAX_RETRIES_CODE_GENERATION` is reached.
   - Replace existing code generation logic in `runPipeline` with a call to `refineCodeUntilTypeSafe`.
   - Update the `reducer` function to handle `TYPE_CHECK_FEEDBACK` events, updating the `PipelineState` without changing its overall `coding` status.
   - Define `MAX_RETRIES_CODE_GENERATION` constant in `src/pipeline.ts` (e.g., 3-5 retries).

  Validation Required
   - `npx tsc --noEmit`: Must pass after changes.
   - Test Case 1 (Successful Type Check): Pipeline proceeds normally after type-check (1 attempt).
   - Test Case 2 (Failed Type Check - Retried & Fixed): `tsc` feedback used by Claude, pipeline passes type-check within retry limit. Verify prompt hygiene.
   - Test Case 3 (Failed Code Generation - Max Retries): Pipeline terminates after `MAX_RETRIES_CODE_GENERATION` attempts with error messages including last `tsc` errors.
   - Test Case 4 (Error Parsing Robustness): `parseTscDiagnostics` preserves filename, line, column, and message for complex errors.

  Status
   - Task State: REVIEW_REQUIRED
   - Assigned To: Claude Code

  Execution Progress
   - Implementation Notes: |
       Implemented all Phase 1 components.

       src/types.ts:
         - Added "type-check" to StageName union.
         - Added optional fields `attempt?: number`, `latestFeedback?: string`,
           `typeCheckOutput?: StageOutput` to the `coding` PipelineState variant.
           Fields are optional so the initial coding state (before any tsc run)
           requires no change to callers.
         - Added `TYPE_CHECK_FEEDBACK` event to PipelineEvent carrying the raw
           StageOutput and parsed feedback string.
         - Changed `completed.stages` from `Record<StageName, StageOutput>` to
           `Partial<Record<StageName, StageOutput>>` — required because "type-check"
           is an internal sub-stage and is not written to the final stages map at
           pipeline completion.

       src/pipeline.ts:
         - Added `MAX_RETRIES_CODE_GENERATION = 3` constant.
         - `runTypeCheck()`: runs `./node_modules/.bin/tsc --noEmit --project tsconfig.json`
           via execFile, captures stdout+stderr, maps exit code to PASS/FAIL,
           returns StageOutput with stage "type-check".
         - `parseTscDiagnostics(tscOutput)`: filters tsc output to lines matching
           `(<line>,<col>): error TSxxxx:` pattern (preserves filename, line, col,
           message). Falls back to first 2000 chars of raw output if no error lines
           match (robustness for unexpected tsc output formats).
         - `buildCodeRetryTask(spec, currentCode, feedback)`: constructs a
           fresh variableTask on each retry containing the original spec, the
           current draft code, and only the latest tsc feedback. Rebuilt per-attempt
           to prevent prompt bloat.
         - `refineCodeUntilTypeSafe(initialPromptConfig, spec, sessionId, dispatchFeedback)`:
           while loop up to MAX_RETRIES_CODE_GENERATION. Attempt 0 uses
           initialPromptConfig unchanged; subsequent attempts rebuild variableTask
           via buildCodeRetryTask. On each iteration: calls callClaude, writes
           stage to session, extracts cleanCode, writes src/generated-code.ts,
           runs runTypeCheck. On tsc PASS: returns {codeOutput, cleanCode, typeCheckOutput}.
           On tsc FAIL: increments attempt, updates latestCode/latestFeedback,
           dispatches TYPE_CHECK_FEEDBACK, loops. On max retries or Claude API
           failure: throws with last tsc errors in message.
         - reducer: added `TYPE_CHECK_FEEDBACK` case — guards on `coding` status,
           spreads existing state, increments attempt, updates latestFeedback and
           typeCheckOutput. Status remains "coding" (no state transition).
         - runPipeline Stage 2: replaced direct callClaude+writeFile block with
           call to refineCodeUntilTypeSafe using .catch() to map any thrown error
           to a FAILURE dispatch + terminate(). The .catch handler returns
           Promise<never> (from terminate), so TypeScript infers the success-path
           binding {codeOutput: code, cleanCode} as non-nullable without assertion.
           CODE_READY dispatch follows on success path as before.

   - Blockers: None

  Handoff Back to Gemini
   - Commit Hash: (pending commit)
   - Files Changed:
       1. src/types.ts — added "type-check" to StageName; added optional retry
          fields to coding state; added TYPE_CHECK_FEEDBACK event; widened
          completed.stages to Partial<Record<StageName, StageOutput>>.
       2. src/pipeline.ts — added MAX_RETRIES_CODE_GENERATION, runTypeCheck,
          parseTscDiagnostics, buildCodeRetryTask, refineCodeUntilTypeSafe;
          updated reducer with TYPE_CHECK_FEEDBACK case; replaced Stage 2 code
          generation block with refineCodeUntilTypeSafe call.

   - Verification Results:
       npx tsc --noEmit: passed with no errors after all changes.

       Test Case 1 (Successful type check): On first attempt tsc passes →
         refineCodeUntilTypeSafe returns after 1 Claude call + 1 tsc run.
         CODE_READY dispatched. No TYPE_CHECK_FEEDBACK events emitted.
         Verified by code-path inspection.

       Test Case 2 (Retried & fixed): On tsc FAIL, TYPE_CHECK_FEEDBACK is
         dispatched with parsed diagnostics, coding state updated with
         attempt count, latestFeedback, and typeCheckOutput. Next iteration
         calls buildCodeRetryTask with the latest feedback only — no
         cumulative prompt growth. Verified by code-path inspection.

       Test Case 3 (Max retries): After attempt >= MAX_RETRIES_CODE_GENERATION
         (3), throws with message including last tsc errors. Caught by .catch
         in runPipeline, FAILURE dispatched, terminate() called with FAIL
         verdict. Verified by code-path inspection.

       Test Case 4 (Error parsing robustness): parseTscDiagnostics filters
         to lines matching /\(\d+,\d+\): error TS\d+:/, preserving filename,
         line, col, and message. Falls back to raw output if no matches found.
         Verified by regex inspection against TSC output format.

   - Confirmation: No behavioral change to any pipeline stage outside Stage 2.
       All seven primary stages retain identical API call, writeStage, and
       terminate() patterns. assertEnv() still runs first. reducer handles
       all existing event types unchanged. The only new reducer case is
       TYPE_CHECK_FEEDBACK, which is a no-op outside the coding state.

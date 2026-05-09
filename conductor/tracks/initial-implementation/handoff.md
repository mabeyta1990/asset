Handoff: Initial Pipeline Implementation - Phase 4

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
   - Task State: REVIEW_REQUIRED
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
Handoff: Initial Pipeline Implementation

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

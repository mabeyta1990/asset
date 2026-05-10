# Specification: Initial Pipeline Implementation

## Goal
Implement the core ASSET pipeline, including AI model wrappers with caching, session and canonical state management, orchestration logic, and a sandboxed execution environment.

## Requirements
- 5 stage wrappers (Perplexity, Gemini, Claude, GLM, Nemotron).
- Prompt caching for Claude and context caching for Gemini.
- Session state persistence in `.ai-memory/sessions/`.
- Canonical state management in `.ai-memory/canonical/`.
- Orchestrator (`pipeline.ts`) with retry logic and stage sequencing.
- CLI entry point (`src/scripts/cli.ts`).
- OrbStack/Ubuntu VM integration for test execution.

## Acceptance Criteria (v1)
- `npm run asset "task"` triggers the full pipeline.
- All 5 stages produce JSON artifacts.
- Cache hits confirmed for Claude and Gemini.
- Pre/Post audit gates functional.
- Canonical state updates only on PASS.

## Acceptance Criteria (v2 Hardening)
- Orchestration credentials are kept separate from the execution environment.
- Untrusted code execution is isolated in a sandbox with restricted access to the host repository.
- Pipeline execution is governed by an explicit state machine with valid transition handling.
- Compilation and testing errors are fed back into the generation loop for corrective retries.
- Every pipeline execution produces telemetry for cost and performance monitoring.
- Repo-specific context is bootstrapped once and cached via content hashing to minimize ingestion latency.
- Cached prefixes are refreshed only when stable context (README, architecture, etc.) changes or TTL expires.
- Cached end-to-end execution completes within the 5-minute performance envelope.


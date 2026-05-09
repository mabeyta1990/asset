# Implementation Plan: Initial Pipeline Implementation

## Phase 1: Core Wrappers & Caching (DONE)
- [x] Implement `src/types.ts`.
- [x] Implement `src/wrappers/claude.ts` (Prompt Caching).
- [x] Implement `src/wrappers/gemini.ts` (Context Caching).
- [x] Implement `src/wrappers/perplexity.ts` (Implemented as `research.ts` using Tavily).
- [x] Implement `src/wrappers/glm.ts`.
- [x] Implement `src/wrappers/nemotron.ts`.

## Phase 2: Memory & Persistence (DONE)
- [x] Implement `src/memory.ts`.
- [x] Implement `src/cache/canonical.ts`.
- [x] Implement `src/cache/refresh.ts`.

## Phase 3: Orchestration & CLI (DONE)
- [x] Implement `src/pipeline.ts`.
- [x] Implement `src/scripts/cli.ts`.

## Phase 4: v2 Hardening Pass (IN-PROGRESS)
- [x] Implement Doppler Secrets Integration (Separation of orchestration and execution secrets).
- [x] Refactor `src/pipeline.ts` into a type-safe state machine
    - [x] Define `PipelineState` and `PipelineEvent` types in `src/types.ts`.
    - [ ] Implement the state reducer and transition logic.
- [ ] Implement feedback-threaded retry logic (Parsing `tsc` and `vitest` errors for LLM correction).
- [ ] Implement per-run cost and performance telemetry (Prisma/PostgreSQL integration as per roadmap).
- [ ] Enhance OrbStack/Ubuntu VM sandbox (Restricted repo mounts and execution hardening).
- [ ] Stabilize prompt templates in `src/cache/prefixes.ts`.
- [ ] End-to-end smoke test validation with cost/performance auditing.

## Phase 5: External Integrations (DEFERRED)
- [ ] Native Notion Markdown ingestion and sync.
- [ ] Slack webhook integration for failure escalations.


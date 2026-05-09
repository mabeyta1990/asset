# ASSET Pipeline — Architecture Brief

## What ASSET Is

ASSET is a 5-model AI engineering pipeline. It takes a spec, runs it through five role-isolated stages, and produces audit-approved code with full provenance. Built as a standalone, reusable tool — first deployment is Ceramonies, will extend to BarrierLinens and future projects.

## The Acronym

- **A**nalysis → Research (Perplexity Sonar)
- **S**trategy → Plan (Gemini Pro)
- **S**cripting → Code (Claude Opus 4.7) + Tests (GLM-5.1)
- **E**valuation → Test execution (GLM in Ubuntu VM) + Audit (Nemotron 3 Super, pre + post)
- **T**rust → Approval gate that updates canonical cache state on PASS

## Core Principles

1. **No model grades its own work.** Spec is the only common input across stages.
2. **Independence at every checkpoint.** Three different models touch every artifact before ship.
3. **Cache reflects shipped state, not in-flight state.** Canonical cache only updates on post-audit PASS.
4. **Failed runs don't pollute future runs.** Session state is ephemeral; canonical state is durable.
5. **Sandbox isolation for execution.** GLM runs in Ubuntu VM with read-only repo mount.

## Pipeline Flow

```
Spec (Notion via MCP)
    ↓
[A] Perplexity → fresh research
    ↓
[S] Gemini → plan with explicit test cases
    ↓
[S] Claude → implementation code (no tests)
[S] GLM → tests (separate context, against spec)
    ↓
[E] Nemotron pre-audit → reviews code + tests vs spec
    ├── FAIL → route feedback to whoever failed, retry (max 3)
    └── PASS → continue
    ↓
[E] GLM in Ubuntu VM → execute tests
    ├── FAIL → retry Claude with execution traces
    └── PASS → continue
    ↓
[E] Nemotron post-audit → reviews execution + results vs spec
    ├── FAIL → retry with audit feedback
    ├── ESCALATE → Slack ping after 3 failures
    └── PASS → [T] Trust gate
    ↓
[T] On approval ONLY:
    - Write files to repo
    - Run migrations
    - Update Notion roadmap
    - Append Daily Build Log
    - Refresh canonical caches
    - Archive session
```

## Implementation Strategy: Hybrid SDK + curl

| Stage | Implementation | Why |
|---|---|---|
| Perplexity (research) | curl | Fresh by design, no caching benefit |
| Gemini (plan) | SDK | Needs `cachedContents.create()` for context caching |
| Claude (code) | SDK | Needs `cache_control: ephemeral` markers |
| GLM (tests + execution) | curl | Auto-cached server-side by provider |
| Nemotron (audits) | curl | Auto-cached server-side by DeepInfra |

TypeScript orchestrator (`pipeline.ts`) calls SDK wrappers directly and shells out to curl wrappers via async `execFile` with Promise wrappers.

## Caching Discipline

Every prompt has stable prefix + variable suffix:

```
[STABLE PREFIX — cached]
- System role definition
- Project context (spec, schema, conventions)
- Tool definitions

[VARIABLE SUFFIX — not cached]
- Specific task
- Prior attempt feedback
- Session-specific data
```

**Claude wrapper:** `cache_control: { type: "ephemeral" }` markers on system prompt and codebase context blocks. Variable task content comes after, no marker.

**Gemini wrapper:** `cachedContents.create()` with stable project context. TTL 24 hours. Refresh on schema/spec change. Reuse cached content name across pipeline runs.

**Cache invalidation triggers:**
1. Spec change (Notion page modified)
2. Codebase change (new git commit hash)
3. TTL expiry (automatic)
4. Post-audit PASS (refresh with new canonical state)

## File Structure

```
~/Developer/asset/
├── src/
│   ├── wrappers/
│   │   ├── perplexity.ts         ← curl wrapper
│   │   ├── gemini.ts             ← SDK + cachedContents lifecycle
│   │   ├── claude.ts             ← SDK + cache_control markers
│   │   ├── glm.ts                ← curl wrapper
│   │   └── nemotron.ts           ← curl wrapper (pre + post modes)
│   ├── cache/
│   │   ├── canonical.ts          ← Read approved cache state
│   │   ├── prefixes.ts           ← Stable prompt templates
│   │   └── refresh.ts            ← Update caches on approval
│   ├── scripts/
│   │   └── cli.ts                ← Warp entry point
│   ├── pipeline.ts               ← Orchestrator
│   ├── memory.ts                 ← Session state management
│   └── types.ts                  ← Shared interfaces
├── .ai-memory/                   ← Gitignored
│   ├── current.json              ← Pointer to approved state
│   ├── canonical/                ← Approved cache pointers + state
│   │   ├── codebase-hash.txt
│   │   ├── schema.sql
│   │   ├── decisions.md
│   │   └── cache-pointers.json
│   └── sessions/
│       └── [timestamp]/
│           ├── 00-research.json
│           ├── 01-plan.json
│           ├── 02-code.json
│           ├── 03-tests.json
│           ├── 04-audit-pre.json
│           ├── 05-execution.json
│           ├── 06-audit-post.json
│           └── final.json
├── docs/
│   └── architecture.md           ← This file
└── package.json
```

## Memory State Pattern

Two distinct concerns, separate modules:

**Session state** (`memory.ts` → sessions/):
- Per-pipeline-run
- Each stage reads previous stage's output JSON
- Lives and dies with the run
- Failed runs archived for analysis

**Canonical state** (`cache/canonical.ts` → canonical/):
- Updates only on post-audit PASS
- Holds cache pointers, codebase hash, schema, decisions
- The state cache layer reads from
- Durable across runs

Mixing the two is how cache pollution happens. Keep them separated.

## Stack Dependencies

**Required at build time:**
- Node.js 20+, TypeScript, tsx
- `@anthropic-ai/sdk`
- `@google/generative-ai`
- API keys: Anthropic, Google AI, Perplexity, Z.ai (GLM), NVIDIA/DeepInfra (Nemotron)

**Required for execution:**
- OrbStack with Ubuntu VM
- Read-only mount: host repo → VM `/workspace`
- Writable mount: VM `/output` → host `.ai-memory/sessions/[id]/glm-output/`

**Sunday additions:**
- Doppler for secret management
- Slack webhook for escalations
- Notion MCP for spec reads + roadmap updates

## Build Order (Saturday)

Phase 1: Wrappers (validate caching first)
1. `claude.ts` — implement, smoke test cache hits
2. `gemini.ts` — implement with cachedContents lifecycle, smoke test
3. `perplexity.ts`, `glm.ts`, `nemotron.ts` — curl wrappers

Phase 2: Memory + State
4. `types.ts` — shared interfaces
5. `memory.ts` — session state management
6. `cache/canonical.ts` — canonical state reads
7. `cache/refresh.ts` — approval-gated cache updates

Phase 3: Orchestration
8. `pipeline.ts` — orchestrator with retry logic
9. `scripts/cli.ts` — Warp entry point

Phase 4: VM
10. OrbStack + Ubuntu VM
11. Mount config
12. End-to-end smoke test on tiny real task

## Validation Gates

Each phase has a smoke test before moving on:

- **Claude wrapper:** Run twice with identical stable context, different tasks. Confirm `cache_read_input_tokens > 0` on second call.
- **Gemini wrapper:** Create cached content, reuse name across 2 calls, confirm cost difference.
- **Curl wrappers:** Single successful call with valid JSON response.
- **Memory:** Write session, read back, confirm structure.
- **Canonical:** Refresh on simulated approval, read back updated state.
- **Pipeline:** End-to-end on tiny task (e.g., "generate a hello world function with one test"). All 7 session JSON files produced. Final.json shows PASS or expected FAIL.

## Time Budget

- Saturday: ~5 hours
  - Phase 1 (wrappers): 2 hours
  - Phase 2 (memory/state): 1 hour
  - Phase 3 (orchestration): 1.5 hours
  - Phase 4 (VM + smoke test): 1 hour (VM setup itself ~30 min)
- Sunday: ~3 hours
  - Doppler, Slack, Notion MCP, refinement

## Acceptance Criteria

ASSET is operational when:
1. `npm run asset "task description"` triggers full pipeline
2. All 5 stages produce session JSON in `.ai-memory/sessions/[timestamp]/`
3. Cache hits confirmed on Claude and Gemini stages (verify in response metadata)
4. Pre-audit and post-audit gates work (failures retry with feedback, ship on PASS)
5. Canonical state updates only on PASS
6. End-to-end run on a real task completes in under 5 minutes (cached) or 10 minutes (cold)

## What ASSET Doesn't Do (Deferred)

- OTel observability (defer until concurrent runs need debugging)
- Hot-swap routing across Kimi/Grok/DeepSeek (defer until cost is real)
- 8-hour GLM autonomy mode (defer until job needs it)
- Local model hosting (skip — not needed)
- Enterprise OPA policies (skip — overkill at this stage)

## Reusability

ASSET is project-agnostic. Per-project configuration via env vars:
- `ASSET_SPEC_SOURCE` — Notion DB ID or filesystem path
- `ASSET_REPO_PATH` — target repo for code writes
- `ASSET_PROJECT_NAME` — for cache namespacing
- `ASSET_DOPPLER_PROJECT` — secrets scope

First consumer: Ceramonies. Future consumers: BarrierLinens, mobile apps, anything else built.

## Status

- Architecture: locked
- Folder structure: created at `~/Developer/asset/`
- Dependencies: installed
- TypeScript: configured
- Next step: Gemini CLI consumes this doc, produces detailed build spec for Saturday

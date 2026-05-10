# ASSET

**A**nalysis · **S**trategy · **S**cripting · **E**valuation · **T**rust

A 7-stage multi-model AI pipeline that takes a plain-English specification and produces tested, audited TypeScript — running real tests in an isolated VM before declaring success.

## How it works

Each stage uses the best available model for that task by default, but can be overridden per-task:

| Stage | Default Model | What it does |
|-------|---------------|--------------|
| 0 — Research | Tavily | Web-searches the spec for relevant context and prior art |
| 1 — Plan | Nemotron 70B | Produces a numbered implementation plan with testable acceptance criteria |
| 2 — Code | Haiku 4.5 | Writes the TypeScript implementation from the plan |
| 3 — Tests | Haiku 4.5 | Writes vitest tests against the clean implementation |
| 4 — Pre-audit | Nemotron 70B | Audits code and tests against the spec before execution |
| 5 — Execution | OrbStack VM | Runs vitest in an isolated Linux VM via `orb` |
| 6 — Post-audit | Nemotron 70B | Audits execution results; finalizes verdict |

A session is written to disk at each stage. If any stage returns `ESCALATE`, the pipeline halts and exits with code 2. `FAIL` also halts (except pre-audit, which lets the pipeline continue to VM execution). On full `PASS`, the canonical Gemini context cache is refreshed.

### Telemetry & Cost Monitoring

ASSET tracks operational telemetry (token usage, cache hits, retries) and calculates real-time costs based on the May 2026 pricing registry.

To view a summary of costs incurred across all sessions:

```bash
npm run asset -- cost --summary
```

This command generates a breakdown of costs by Model, Pipeline Stage, and Task ID.


## Agents Overview

- Gemini agent (conductor/gemini.md)
  - Role: high-level planner and handoff author.
  - Responsibilities: analyze goals, produce work plans, create explicit handoffs under conductor/tracks/*/handoff.md, and own project scope decisions.
  - Output: small, reviewable tasks and approval-ready handoffs.

- Claude agent (conductor/claude.md)
  - Role: implementation executor.
  - Responsibilities: perform surgical, file-scoped edits from handoff, add or update tests, run existing test suites, and commit changes with the required co-author trailer.
  - Constraints: only edit files explicitly listed in the handoff; do not modify conductor/** or GEMINI.md unless granted permission.

- Project Orchestrator (project-orchestrator.agent.md)
  - Role: coordinator and state reporter.
  - Responsibilities: summarize project state, identify files & open questions, propose next steps and ownership, and prepare handoffs for implementers.
  - Rules: do not run commands or implement changes unless explicitly requested; keep outputs concise and actionable; always include Objective / Current state / Relevant files / Proposed steps / Risks / Next actions / Handoff.

## Requirements

- Node.js 20+
- [OrbStack](https://orbstack.dev) with a machine named `asset-runner`
- vitest installed inside the VM at `~/asset-deps/node_modules/.bin/vitest`
- API keys for Anthropic, Google Generative AI, Tavily, and Nemotron set in your environment

## Usage

ASSET supports both plain-text prompts and structured JSON task specifications:

```bash
# Plain-text prompt
npm run asset "Write a TypeScript function that debounces a callback by N milliseconds"

# JSON Task Specification
npm run asset tasks/debounce.json
```

## Integrating ASSET into your repository

To add ASSET to an existing project:

1. Copy the `conductor/` directory and its contents from the ASSET repository.
2. Update the `conductor/product.md` and `conductor/tech-stack.md` to reflect your project's specific goals and technologies.
3. Configure your environment variables to include the required API keys (Anthropic, Google Generative AI, Tavily, Nemotron).
4. Ensure your project has `vitest` installed and that you have an isolated environment (like OrbStack or similar) configured as expected by the pipeline.
5. Add the necessary `package.json` scripts to trigger the pipeline, referencing the `asset` entry point.
6. Create an initial track in `conductor/tracks/` to define your first project objective.

On success:

```
[PASS] Pipeline completed successfully
```

On failure or escalation, the stage name, verdict, and a preview of the output are printed to stderr.

## Output files

| File | Contents |
|------|----------|
| `src/generated-code.ts` | The generated implementation (fence-stripped, clean) |
| `src/generated-tests.test.ts` | The generated vitest tests (patched for vitest compatibility) |

## Test compatibility patches

Before the VM runs, the test file is automatically patched:

- `test(` → `it(`
- `from '@jest/globals'` → `from 'vitest'`
- `.toBe(<float>)` → `.toBeCloseTo(<float>)`
- Duplicate vitest import lines are collapsed to one
- Trailing content after the last `});` is trimmed

## Development

```bash
npm run build   # TypeScript compile
npm test        # Run vitest on generated tests locally
```

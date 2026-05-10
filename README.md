# ASSET

**A**nalysis · **S**trategy · **S**cripting · **E**valuation · **T**rust

A 7-stage multi-model AI pipeline that takes a plain-English specification and produces tested, audited TypeScript — running real tests in an isolated VM before declaring success.

## How it works

Each stage uses the best available model for that task:

| Stage | Model | What it does |
|-------|-------|--------------|
| 0 — Research | Tavily | Web-searches the spec for relevant context and prior art |
| 1 — Plan | Gemini 2.5 Pro | Produces a numbered implementation plan with testable acceptance criteria |
| 2 — Code | Claude Opus 4.7 | Writes the TypeScript implementation from the plan |
| 3 — Tests | Claude Opus 4.7 | Writes vitest tests against the clean implementation |
| 4 — Pre-audit | Nemotron | Audits code and tests against the spec before execution |
| 5 — Execution | OrbStack VM | Runs vitest in an isolated Linux VM via `orb` |
| 6 — Post-audit | Nemotron | Audits execution results; finalizes verdict |

A session is written to disk at each stage. If any stage returns `ESCALATE`, the pipeline halts and exits with code 2. `FAIL` also halts (except pre-audit, which lets the pipeline continue to VM execution). On full `PASS`, the canonical Gemini context cache is refreshed.

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

```bash
npm run asset "Write a TypeScript function that debounces a callback by N milliseconds"
```

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

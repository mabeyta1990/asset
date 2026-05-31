# ASSET

**A**nalysis · **S**trategy · **S**cripting · **E**valuation · **T**rust

A 7-stage agentic pipeline that takes a plain-English specification and produces tested, audited TypeScript — running real tests in an isolated VM before declaring success.

## How it works

| Stage | Default | What it does |
|-------|---------|--------------|
| 0 — Research | Tavily | Web-searches the spec for prior art and context |
| 1 — Plan | Nemotron 70B | Produces a numbered plan with testable acceptance criteria |
| 2 — Code | Sonnet 4.6 | Writes the TypeScript implementation |
| 3 — Tests | Sonnet 4.6 | Writes vitest tests against the implementation |
| 4 — Pre-audit | Nemotron 70B | Audits code and tests against the spec before execution |
| 5 — Execution | OrbStack VM | Runs vitest in an isolated Linux VM |
| 6 — Post-audit | Nemotron 70B | Audits execution results and finalizes verdict |

Each stage model can be overridden independently via CLI flag or task spec. Sessions are written to disk at each stage. `ESCALATE` halts and exits with code 2. On full `PASS`, the context cache is refreshed.

### Telemetry & Cost Monitoring

ASSET tracks token usage, cache hits, and retries per stage and calculates real-time costs across all supported providers.

```bash
npm run asset -- cost --summary
```

Generates a breakdown by model, pipeline stage, and task ID.

## Usage

```bash
# Plain-text prompt
npm run asset "Write a TypeScript function that debounces a callback by N milliseconds"

# JSON task specification
npm run asset tasks/debounce.json

# Override the code stage model
npm run asset tasks/debounce.json --model-code claude-opus-4-7
npm run asset tasks/debounce.json --model-code gpt-4o
npm run asset tasks/debounce.json --model-code gpt-4o-mini
```

### Supported models

| Provider | Models |
|----------|--------|
| Anthropic | `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5` |
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o4-mini`, `o3-mini` |
| Nemotron | `nemotron-plan`, `nemotron-audit` |
| Tavily | `tavily-search` |

### Task Specification

```json
{
  "id": "debounce-fn",
  "title": "Debounce utility",
  "description": "A TypeScript debounce function with leading/trailing edge support",
  "models": { "code": "gpt-4o" }
}
```

- **Required fields**: `id`, `title`, `description`
- **Optional fields**: `mode` (create|patch|update), `insertPath`, `models` (per-stage overrides)
- **Validation**: enum validation for modes and models, path format verification, clear per-field errors

### Interactive Mode

Human-in-the-loop oversight at each stage:

```bash
asset <spec> --interactive
```

- **[C]ontinue** — move to the next stage
- **[R]etry with feedback** — inject feedback into the next attempt
- **[A]bort** — exit gracefully

## Requirements

- Node.js 20+
- [OrbStack](https://orbstack.dev) with a machine named `asset-runner`
- vitest installed inside the VM at `~/asset-deps/node_modules/.bin/vitest`
- API keys for your chosen providers (see `.env.example`)

## Output files

| File | Contents |
|------|----------|
| `src/generated-code.ts` | Generated implementation (fence-stripped) |
| `src/generated-tests.test.ts` | Generated vitest tests (patched for compatibility) |

## Development

```bash
npm run build   # TypeScript compile
npm test        # Run test suite
```

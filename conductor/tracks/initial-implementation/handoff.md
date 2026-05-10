# Handoff: Implement Cost Dashboard CLI Aggregator

## Overview
Implement a CLI aggregation command to analyze and report session telemetry costs.

## Requirements
1. **CLI Command:** Implement `asset cost --summary` in `src/scripts/cli.ts`.
2. **Aggregation Logic:** Create a utility to process all session JSON files in the telemetry/session storage path.
   - Aggregate token usage and costs by model, stage, and task ID.
   - Reuse existing pricing logic from `src/pricing/registry.ts`.
3. **Report:** Output a clean, summarized table or list showing:
   - Total costs by model.
   - Total costs by stage.
   - Total costs by task ID.
4. **Safety:** Handle partially priced providers (missing pricing data) gracefully without crashing.
5. **Testing:** Add unit tests to verify aggregation accuracy and CLI input handling.

## Scope
- Modify `src/scripts/cli.ts` to support the new command.
- Implement an aggregation module (e.g., `src/pricing/aggregator.ts`).
- Add tests in a new or existing test file (e.g., `src/pricing/aggregator.test.ts`).

## Standards
- Ensure strict adherence to `src/types.ts` for telemetry and stage output shapes.
- Use the existing `src/pricing/registry.ts` for all cost lookups.
- Follow the project's existing CLI patterns and coding style.

## Status
- [x] Completed

## Implementation Notes

### Usage
```bash
# Generate and display a cost summary across all sessions
npm run build
node dist/scripts/cli.js cost --summary

# Example output:
# === Cost Breakdown ===
# 
# Total Cost: $1.2345
# 
# By Model:
#   claude-haiku-4-5: $0.8900
#   nemotron-plan: $0.3445
# 
# By Stage:
#   code: $0.8900
#   plan: $0.3445
# 
# By Task:
#   Build a debounce utility function in TypeScript: $1.2345
```

### Implementation Details
- Implemented aggregator module (`src/pricing/aggregator.ts`) with `aggregateCosts()` and `formatCostBreakdown()` functions
- Updated CLI (`src/scripts/cli.ts`) to support `asset cost --summary` subcommand
- Aggregator correctly maps stage names to model selection keys (e.g., "code", "type-check", "tests" → modelSelection.code)
- Pricing calculation handles Claude, Nemotron, and Tavily models with proper token/request scaling
- Added 12 unit tests covering: Claude/Nemotron/Tavily costs, multi-stage sessions, malformed JSON handling, cache token calculations
- All tests passing; build succeeds with no errors
- CLI gracefully handles sessions without modelSelection data (skips them without crashing)

## Blockers
None

## Handoff Back to Gemini
Implementation complete and ready for review. The cost aggregator is fully functional and tested. Existing sessions show $0 total because they lack modelSelection metadata, but the aggregator correctly processes any sessions with proper model selection data. Ready for deployment or further integration testing.

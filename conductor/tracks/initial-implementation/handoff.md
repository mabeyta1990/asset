# Handoff: Implement Interactive Mode

## Overview
Implement an `--interactive` CLI flag that pauses pipeline execution between stages, allowing for human-in-the-loop oversight and feedback.

## Requirements
1. **CLI Command:** Support `asset <spec> --interactive` in `src/scripts/cli.ts`.
2. **Pause/Resume Loop:** Modify `src/pipeline.ts` to pause after each stage completion when interactive mode is active.
3. **Interactive UI:** 
    - Print a summary of the stage output.
    - Prompt for user action: [C]ontinue, [R]etry with feedback, [A]bort.
4. **Feedback Injection:**
    - If "Retry" is selected, collect text feedback from the user.
    - Inject this feedback into the subsequent stage's prompt context.
5. **State Handling:** Persist interactive state/feedback correctly in `SessionState` if required by the pipeline.
6. **Testing:** Add unit/integration tests for:
    - Interactive pause and resumption.
    - Feedback collection and injection into the prompt.
    - Abort behavior.

## Scope
- Modify `src/scripts/cli.ts` to support the `--interactive` flag.
- Modify `src/pipeline.ts` to implement the pause-and-interact logic.
- Update `src/types.ts` as needed for state management.

## Standards
- Ensure strict adherence to `src/types.ts` for telemetry and stage output shapes.
- Follow the project's existing CLI patterns and coding style.
- All code changes must include or update corresponding tests.

## Files Allowed to Change
- `src/scripts/cli.ts`
- `src/pipeline.ts`
- `src/types.ts`

## Status
- [x] IMPLEMENTED

## Implementation Notes

### CLI Changes (`src/scripts/cli.ts`)
- Added `interactive` boolean to `CliArgs` interface
- Updated `parseArgs()` to recognize `--interactive` flag
- Modified `main()` to pass `interactive` option to `runPipeline()`
- Updated usage documentation to include `--interactive` flag

### Pipeline Changes (`src/pipeline.ts`)
- Updated `runPipeline()` signature to accept optional `options: { interactive?: boolean }`
- Implemented `promptInteractive()` function that:
  - Displays stage output summary (first 500 chars)
  - Prompts user for [C]ontinue, [R]etry with feedback, [A]bort
  - Collects feedback text if retry is selected
  - Handles abort by gracefully exiting the pipeline
- Integrated interactive pause after each major stage:
  - Research → Plan feedback injection
  - Plan → Code feedback injection
  - Code → Tests/Pre-audit feedback injection
  - Pre-audit → repeat code stage with feedback
  - Execution → repeat code stage with feedback if tests fail
  - Post-audit → can retry with feedback
- Feedback is injected by appending to `variableTask` in prompt configs
- Interactive retries at code/test stages use existing retry loops with updated feedback

### Type Changes (`src/types.ts`)
- Added `InteractiveAction` type: "continue" | "retry" | "abort"
- Added `INTERACTIVE_FEEDBACK` event type to `PipelineEvent` union
- Supports proper TypeScript typing for interactive mode

### Tests (`src/pipeline.test.ts`)
- Added test suite for `promptInteractive` function
- Added tests for feedback injection into stage configs
- Verified multiple sequential feedback injections
- All existing tests continue to pass (53 tests)

## Blockers
None

## Implementation Verification
- ✅ CLI flag parsing for `--interactive`
- ✅ Interactive pause after all major stages (research, plan, code, tests, audit-pre, execution, audit-post)
- ✅ User input collection for [C]ontinue, [R]etry, [A]bort
- ✅ Feedback injection into subsequent stage prompts
- ✅ Graceful abort handling with session finalization
- ✅ Retry logic with feedback for code and test stages
- ✅ Unit tests for feedback injection patterns
- ✅ Type safety with InteractiveAction and event types

## User Guide

### Using Interactive Mode

Interactive mode enables human oversight and feedback during pipeline execution. After each major pipeline stage completes, the pipeline pauses and prompts for action.

#### Basic Usage

```bash
asset <spec> --interactive
```

#### Example

```bash
asset "Create a TypeScript debounce utility" --interactive
```

#### Interactive Prompt

When a stage completes, you'll see:

```
[$stage-name] Stage completed with status: PASS
[Telemetry] duration=2450ms | claude_tokens(in=1250 out=450) | cache(write=500 read=1200) | cost=$0.008234

Output summary (first 500 chars):
[stage output preview]

[C]ontinue, [R]etry with feedback, [A]bort?
```

**Telemetry breakdown:**
- **duration**: Stage execution time in milliseconds
- **claude_tokens**: Input and output tokens for Claude models
- **cache**: Cache write (creation) and read tokens
- **nemotron_tokens**: Input/output tokens for Nemotron models
- **tavily_requests**: Number of search requests made
- **cost**: Estimated cost in USD for this stage

#### Actions

- **[C]ontinue** (default): Move to the next stage without changes
- **[R]etry with feedback**: Provide feedback that will be injected into the next stage's execution
- **[A]bort**: Exit the pipeline gracefully

#### Example Workflow

```
$ asset "Create debounce utility" --interactive

[$research] Stage completed with status: PASS
[Telemetry] duration=1250ms | tavily_requests=3 | cost=$0.024

Output summary (first 500 chars):
Found 3 relevant sources on debounce patterns...

[C]ontinue, [R]etry with feedback, [A]bort? > c

[$plan] Stage completed with status: PASS
[Telemetry] duration=3450ms | nemotron_tokens(in=2100 out=580) | cost=$0.0018

Output summary (first 500 chars):
Architecture: Implement debounce with timers...

[C]ontinue, [R]etry with feedback, [A]bort? > c

[$code] Stage completed with status: PASS
[Telemetry] duration=4200ms | claude_tokens(in=3850 out=1200) | cost=$0.0156

Output summary (first 500 chars):
export function debounce(fn, delay) { ... }

[C]ontinue, [R]etry with feedback, [A]bort? > r
Provide feedback for the next stage: Add JSDoc comments and improve TypeScript types
...code re-runs with feedback...

[$tests] Stage completed with status: PASS
[Telemetry] duration=2100ms | claude_tokens(in=4200 out=890) | cost=$0.0138

Output summary (first 500 chars):
describe('debounce', () => { ... })

[C]ontinue, [R]etry with feedback, [A]bort? > c
...pipeline continues...
```

#### When to Use Interactive Mode

- **Code reviews with AI**: Review generated output and request adjustments before proceeding
- **Refinement loops**: Iterate on specific stages based on human judgment
- **Quality gates**: Ensure each stage output meets your requirements before downstream processing
- **Learning**: Understand how feedback propagates through the pipeline

## Handoff Back to Gemini
Ready for code review. Interactive mode is fully integrated with CLI, pipeline, and type system. Users can now run `asset <spec> --interactive` to get human-in-the-loop oversight of pipeline execution with comprehensive feedback injection across all stages.

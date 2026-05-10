import Anthropic from "@anthropic-ai/sdk";
import type { PromptConfig, ClaudeUsage, StageOutput, StageName } from "../types.js";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;

const client = new Anthropic();

export async function callClaude(
  config: PromptConfig,
  stageName: StageName,
  attempt = 1
): Promise<StageOutput> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: config.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: config.stableContext,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: config.variableTask,
          },
        ],
      },
    ],
  });

  const usage: ClaudeUsage = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
  };

  const content = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return {
    stage: stageName,
    status: "PASS",
    content,
    usage,
    timestamp: new Date().toISOString(),
    attempt,
  };
}

// ---------------------------------------------------------------------------
// Smoke test — run with: tsx src/wrappers/claude.ts --test
// Success criterion: cache_read_input_tokens > 0 on second call
// ---------------------------------------------------------------------------

const SMOKE_SYSTEM = `You are the Scripting stage of the ASSET pipeline. Your role is to
produce clean, idiomatic TypeScript that satisfies a provided specification. You write
implementation code only — no tests, no mocks. You follow the project's existing conventions,
use strict TypeScript, and avoid any side-effects outside the requested module boundary.

Project context:
- Runtime: Node.js 20+, ESM modules
- Language: TypeScript 5+, strict mode
- Frameworks: none (stdlib + Anthropic SDK + Google Generative AI SDK)
- File structure: src/wrappers/, src/cache/, src/scripts/, src/pipeline.ts, src/types.ts
- Naming: camelCase functions, PascalCase types, kebab-case filenames
- Exports: named only, no default exports
- Error handling: let errors propagate unless a retry strategy is defined in the pipeline
- No console.log in library code; structured output via StageOutput only
- All async functions return Promise<StageOutput>

You will be given a variable task describing what to implement. Respond with only the
TypeScript source — no preamble, no markdown fences, no explanation. The output will be
written directly to a file by the Trust gate on PASS.

Stability contract: this system prompt and the codebase context block that follows are
stable across all pipeline runs and are eligible for prompt caching. Only the task block
that follows the codebase context changes per run.`.repeat(2); // repeat to ensure >1024 tokens

const SMOKE_CONTEXT = `Codebase context (canonical state as of last approved build):

src/types.ts — StageOutput, SessionState, PromptConfig, RetryContext, CanonicalState,
  ClaudeUsage, StageName, StageVerdict

src/wrappers/claude.ts — callClaude(config: PromptConfig, stageName: StageName, attempt?: number)
  Returns StageOutput. Uses Anthropic SDK with cache_control ephemeral markers on system
  prompt and stableContext blocks.

src/pipeline.ts — not yet implemented
src/memory.ts — not yet implemented
src/cache/canonical.ts — not yet implemented
src/cache/refresh.ts — not yet implemented

Dependencies installed:
  @anthropic-ai/sdk ^0.95.1
  @google/generative-ai ^0.24.1

Environment variables expected at runtime:
  ANTHROPIC_API_KEY
  GOOGLE_AI_API_KEY
  PERPLEXITY_API_KEY
  ZAI_API_KEY
  DEEPINFRA_API_KEY

All wrappers must return StageOutput. Failures surface as status "FAIL" or "ERROR" with
content containing the error message. The pipeline retries up to maxAttempts (default 3).

This context block is stable and cached. Do not modify it mid-session. The next block
contains the variable task for this run.`.repeat(3); // repeat to ensure >1024 tokens

async function runSmokeTest(): Promise<void> {
  console.log("Claude wrapper smoke test");
  console.log("Criterion: cache_read_input_tokens > 0 on second call\n");

  const config: PromptConfig = {
    systemPrompt: SMOKE_SYSTEM,
    stableContext: SMOKE_CONTEXT,
    variableTask: "",
  };

  console.log("Call 1 — cache WRITE expected");
  config.variableTask = "Return the string 'hello from call 1' as a TypeScript const export.";
  const result1 = await callClaude(config, "code", 1);
  const usage1 = result1.usage as ClaudeUsage;
  console.log(`  cache_creation_input_tokens : ${usage1.cache_creation_input_tokens}`);
  console.log(`  cache_read_input_tokens     : ${usage1.cache_read_input_tokens}`);
  console.log(`  input_tokens                : ${usage1.input_tokens}`);
  console.log(`  output_tokens               : ${usage1.output_tokens}\n`);

  console.log("Call 2 — cache READ expected");
  config.variableTask = "Return the string 'hello from call 2' as a TypeScript const export.";
  const result2 = await callClaude(config, "code", 1);
  const usage2 = result2.usage as ClaudeUsage;
  console.log(`  cache_creation_input_tokens : ${usage2.cache_creation_input_tokens}`);
  console.log(`  cache_read_input_tokens     : ${usage2.cache_read_input_tokens}`);
  console.log(`  input_tokens                : ${usage2.input_tokens}`);
  console.log(`  output_tokens               : ${usage2.output_tokens}\n`);

  if (usage2.cache_read_input_tokens > 0) {
    console.log("PASS — cache_read_input_tokens > 0 on second call");
    process.exit(0);
  } else {
    console.error("FAIL — cache_read_input_tokens is 0 on second call");
    console.error("Possible causes: stable blocks < 1024 tokens, TTL expired, or API key missing.");
    process.exit(1);
  }
}

if (process.argv.includes("--test")) {
  runSmokeTest().catch((err: unknown) => {
    console.error("Smoke test threw:", err);
    process.exit(1);
  });
}

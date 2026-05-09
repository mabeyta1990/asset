import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAICacheManager } from "@google/generative-ai/server";
import type { CachedContent } from "@google/generative-ai/server";
import type { PromptConfig, StageName, StageOutput } from "../types.js";

const MODEL = "models/gemini-2.5-pro";
const CACHE_TTL_SECONDS = 86_400;
const EXPIRY_BUFFER_MS = 60_000;
const DEFAULT_DISPLAY_NAME = "asset-canonical-context";

const apiKey = process.env.GOOGLE_AI_API_KEY ?? "";
const genAI = new GoogleGenerativeAI(apiKey);
const cacheManager = new GoogleAICacheManager(apiKey);

export interface GeminiUsage extends Record<string, number> {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  cachedContentTokenCount: number;
}

interface CachePointer {
  name: string;
  displayName: string;
}

let pointer: CachePointer | null = null;

function isFresh(c: CachedContent): boolean {
  if (!c.expireTime) return false;
  return Date.parse(c.expireTime) > Date.now() + EXPIRY_BUFFER_MS;
}

async function findCacheByDisplayName(displayName: string): Promise<CachedContent | null> {
  let pageToken: string | undefined;
  do {
    const res = await cacheManager.list({ pageSize: 100, pageToken });
    for (const c of res.cachedContents ?? []) {
      if (c.displayName === displayName && c.name && isFresh(c)) {
        return c;
      }
    }
    pageToken = res.nextPageToken;
  } while (pageToken);
  return null;
}

async function ensureCache(
  displayName: string,
  systemInstruction: string,
  stableContext: string,
): Promise<CachedContent> {
  if (pointer && pointer.displayName === displayName) {
    try {
      const cached = await cacheManager.get(pointer.name);
      if (isFresh(cached)) return cached;
    } catch {
      pointer = null;
    }
  }

  const existing = await findCacheByDisplayName(displayName);
  if (existing && existing.name) {
    pointer = { name: existing.name, displayName };
    return existing;
  }

  const created = await cacheManager.create({
    model: MODEL,
    displayName,
    systemInstruction,
    contents: [{ role: "user", parts: [{ text: stableContext }] }],
    ttlSeconds: CACHE_TTL_SECONDS,
  });
  if (!created.name) {
    throw new Error("cacheManager.create returned a CachedContent without a name");
  }
  pointer = { name: created.name, displayName };
  return created;
}

export async function deleteCacheByDisplayName(displayName: string): Promise<number> {
  let deleted = 0;
  let pageToken: string | undefined;
  do {
    const res = await cacheManager.list({ pageSize: 100, pageToken });
    for (const c of res.cachedContents ?? []) {
      if (c.displayName === displayName && c.name) {
        await cacheManager.delete(c.name);
        deleted += 1;
      }
    }
    pageToken = res.nextPageToken;
  } while (pageToken);
  if (pointer && pointer.displayName === displayName) pointer = null;
  return deleted;
}

export async function callGemini(
  config: PromptConfig,
  stageName: StageName,
  attempt = 1,
  options: { displayName?: string } = {},
): Promise<StageOutput> {
  const displayName = options.displayName ?? DEFAULT_DISPLAY_NAME;
  const cache = await ensureCache(displayName, config.systemPrompt, config.stableContext);
  const model = genAI.getGenerativeModelFromCachedContent(cache);
  const result = await model.generateContent(config.variableTask);
  const meta = result.response.usageMetadata;

  const usage: GeminiUsage = {
    promptTokenCount: meta?.promptTokenCount ?? 0,
    candidatesTokenCount: meta?.candidatesTokenCount ?? 0,
    totalTokenCount: meta?.totalTokenCount ?? 0,
    cachedContentTokenCount: meta?.cachedContentTokenCount ?? 0,
  };

  return {
    stage: stageName,
    status: "PASS",
    content: result.response.text(),
    usage,
    timestamp: new Date().toISOString(),
    attempt,
  };
}

// ---------------------------------------------------------------------------
// Smoke test — run with: tsx src/wrappers/gemini.ts --test
// Success criterion: usageMetadata.cachedContentTokenCount > 0 on second call
// Note: explicit caching requires >= 32,768 input tokens in the stable block.
// ---------------------------------------------------------------------------

const SMOKE_DISPLAY_NAME = "asset-smoke-test";

const SMOKE_SYSTEM = `You are the Strategy stage of the ASSET pipeline. Your role is to take a
research brief and produce an implementation plan with explicit, testable acceptance criteria.
Plans must enumerate concrete test cases — each one a single observable behavior with input,
action, and expected output. You write plans only; you do not write code or tests yourself.

Constraints on every plan you produce:
- Stage boundary: plan only. No code, no tests, no commentary on tooling unless required by the spec.
- Output format: numbered sections (Goals, Approach, Acceptance Criteria, Test Cases, Risks).
- Test cases use Given/When/Then phrasing.
- Each test case is independent and isolated; no shared mutable state across cases.
- The plan must be executable by a separate Scripting model with no further questions.
- Reference the stable codebase context that follows; do not invent files or modules.

You will receive a variable task block describing what the user wants. Respond with the plan only.`;

function buildBigStableContext(): string {
  // Gemini requires >= 32,768 input tokens for explicit caching.
  // We synthesize a stable, plausible canonical-context block large enough to clear
  // that floor with margin. Token-to-char ratio ~1:4 in English, so we target ~160k chars.
  const block = `Canonical project context — ASSET pipeline (frozen, cache-eligible).

Repository layout:
  src/types.ts                 — StageOutput, SessionState, PromptConfig, RetryContext, CanonicalState
  src/wrappers/claude.ts       — Anthropic SDK with cache_control ephemeral markers
  src/wrappers/gemini.ts       — Google AI SDK with GoogleAICacheManager lifecycle (this file)
  src/wrappers/perplexity.ts   — curl wrapper for fresh research; no caching by design
  src/wrappers/glm.ts          — curl wrapper for code/test generation and VM-side execution
  src/wrappers/nemotron.ts     — curl wrapper for pre- and post-execution audits
  src/cache/canonical.ts       — read approved cache state from .ai-memory/canonical
  src/cache/refresh.ts         — write approved cache state on Trust-gate PASS
  src/cache/prefixes.ts        — stable prompt templates per stage
  src/memory.ts                — session-state JSON writes to .ai-memory/sessions/<timestamp>
  src/pipeline.ts              — stage sequencing, retry up to 3, fail-fast escalation
  src/scripts/cli.ts           — Warp entry point; argv → pipeline.run()

Stage map (acronym ASSET):
  A — Analysis  → Perplexity Sonar (research)
  S — Strategy  → Gemini 2.5 Pro (plan)
  S — Scripting → Claude Opus 4.7 (code) + GLM 5.1 (tests, separate context)
  E — Evaluation → Nemotron pre-audit, GLM-in-VM execution, Nemotron post-audit
  T — Trust     → human-or-rule approval gate; on PASS, refresh canonical caches and ship

Caching discipline:
  Stable prefix (cache-eligible): system role definition, project context, conventions, schema.
  Variable suffix (never cached): the per-run task, prior-attempt feedback, session-specific data.
  Claude: cache_control ephemeral markers on system + stableContext blocks; min 1024 tokens.
  Gemini: GoogleAICacheManager.create with displayName lookup, TTL 86400s; min 32768 tokens.
  Perplexity, GLM, Nemotron: provider-side caching only; no client lifecycle.

Cache invalidation triggers:
  1. Spec change (Notion page modified — invalidates Strategy stage cache).
  2. Codebase change (new git commit hash — invalidates Scripting stage cache).
  3. TTL expiry (automatic; 24h Gemini, 5min Claude ephemeral).
  4. Post-audit PASS (refresh.ts writes new canonical pointer; old caches deleted).

Retry policy:
  Each stage retries up to maxAttempts (default 3). Failures attach feedback to the next attempt's
  variableTask. After 3 failures the pipeline ESCALATES — Slack ping in production, exit(2) in CLI.

Error surface:
  All wrappers return StageOutput. status ∈ {PASS, FAIL, ERROR, ESCALATE}. ERROR indicates a
  transport- or provider-level fault; FAIL indicates a verdict from a downstream auditor; PASS
  indicates the stage produced an artifact suitable for the next stage.

Coding conventions:
  - TypeScript strict mode, ESM modules, Node.js 20+.
  - Named exports only, no default exports.
  - kebab-case filenames, camelCase functions, PascalCase types.
  - No console.log in library code; structured output via StageOutput only.
  - All async functions return Promise<StageOutput> at the wrapper boundary.
  - Curl wrappers use execFile to avoid shell injection; never spawn a shell.
  - Session-state writes are atomic via temp-file + rename; never partial JSON on disk.

Schema notes (for Strategy plans that touch persistence):
  Tables are created via numbered SQL migrations under db/migrations/NNNN_description.sql.
  Migrations are forward-only; rollbacks are new migrations, not reversed prior ones.
  Foreign keys are required; cascade rules are explicit per relation.
  Timestamps are TIMESTAMPTZ, defaulting to now() in UTC.

Stability contract:
  This block is intended to be byte-stable across pipeline runs. Any drift invalidates the cache
  and forces a recreation, which costs latency and tokens. Refresh deliberately on canonical
  approval, never opportunistically.

End of canonical context block. The variable task that follows is per-run.
`;
  return block.repeat(60);
}

async function runSmokeTest(): Promise<void> {
  console.log("Gemini wrapper smoke test");
  console.log("Criterion: usageMetadata.cachedContentTokenCount > 0 on second call\n");

  if (!apiKey) {
    console.error("GOOGLE_AI_API_KEY is not set.");
    process.exit(1);
  }

  // Start clean so the test deterministically exercises create→reuse.
  const purged = await deleteCacheByDisplayName(SMOKE_DISPLAY_NAME);
  if (purged > 0) console.log(`Purged ${purged} stale cache(s) named "${SMOKE_DISPLAY_NAME}".\n`);

  const stableContext = buildBigStableContext();
  console.log(`Stable context size: ${stableContext.length.toLocaleString()} chars (~${Math.round(stableContext.length / 4).toLocaleString()} tokens est.)\n`);

  const config: PromptConfig = {
    systemPrompt: SMOKE_SYSTEM,
    stableContext,
    variableTask: "",
  };

  try {
    console.log("Call 1 — cache CREATE expected");
    config.variableTask =
      "Plan: a single TypeScript function exported from src/hello.ts that returns the string 'hello from call 1'. Produce a minimal plan.";
    const result1 = await callGemini(config, "plan", 1, { displayName: SMOKE_DISPLAY_NAME });
    const usage1 = result1.usage as GeminiUsage;
    console.log(`  promptTokenCount         : ${usage1.promptTokenCount}`);
    console.log(`  candidatesTokenCount     : ${usage1.candidatesTokenCount}`);
    console.log(`  totalTokenCount          : ${usage1.totalTokenCount}`);
    console.log(`  cachedContentTokenCount  : ${usage1.cachedContentTokenCount}\n`);

    console.log("Call 2 — cache HIT expected");
    config.variableTask =
      "Plan: a single TypeScript function exported from src/hello.ts that returns the string 'hello from call 2'. Produce a minimal plan.";
    const result2 = await callGemini(config, "plan", 1, { displayName: SMOKE_DISPLAY_NAME });
    const usage2 = result2.usage as GeminiUsage;
    console.log(`  promptTokenCount         : ${usage2.promptTokenCount}`);
    console.log(`  candidatesTokenCount     : ${usage2.candidatesTokenCount}`);
    console.log(`  totalTokenCount          : ${usage2.totalTokenCount}`);
    console.log(`  cachedContentTokenCount  : ${usage2.cachedContentTokenCount}\n`);

    if (usage2.cachedContentTokenCount > 0) {
      console.log("PASS — cachedContentTokenCount > 0 on second call");
      process.exit(0);
    } else {
      console.error("FAIL — cachedContentTokenCount is 0 on second call");
      console.error("Possible causes: stable block < 32,768 tokens, cache lookup miss, or model mismatch.");
      process.exit(1);
    }
  } finally {
    await deleteCacheByDisplayName(SMOKE_DISPLAY_NAME).catch(() => {});
  }
}

if (process.argv.includes("--test")) {
  runSmokeTest().catch((err: unknown) => {
    console.error("Smoke test threw:", err);
    process.exit(1);
  });
}

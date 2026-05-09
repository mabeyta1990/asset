import { execFile } from "node:child_process";
import type { PromptConfig, StageName, StageOutput } from "../types.js";

const ENDPOINT = "https://api.tavily.com/search";
const MAX_BUFFER = 50 * 1024 * 1024;
const MAX_RESULTS = 5;

const apiKey = process.env.TAVILY_API_KEY ?? "";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string | null;
}

export interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
  response_time?: number;
}

interface TavilyErrorBody {
  detail?: { error?: string } | string;
  error?: string;
}

function curlPost(body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error("TAVILY_API_KEY is not set"));
      return;
    }
    const args = [
      "-sS",
      "-X",
      "POST",
      ENDPOINT,
      "-H",
      `Authorization: Bearer ${apiKey}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@-",
    ];
    const child = execFile(
      "curl",
      args,
      { maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`curl failed: ${err.message}; stderr: ${stderr}`));
          return;
        }
        resolve(stdout);
      },
    );
    child.stdin?.write(body);
    child.stdin?.end();
  });
}

function buildQuery(config: PromptConfig): string {
  const task = config.variableTask.trim();
  const ctx = config.stableContext.trim();
  if (!ctx) return task;
  return `${task}\n\nContext: ${ctx}`;
}

export async function fetchResearch(config: PromptConfig): Promise<TavilyResponse> {
  const requestBody = JSON.stringify({
    query: buildQuery(config),
    search_depth: "advanced",
    include_answer: true,
    max_results: MAX_RESULTS,
  });

  const stdout = await curlPost(requestBody);

  let parsed: TavilyResponse | TavilyErrorBody;
  try {
    parsed = JSON.parse(stdout) as TavilyResponse | TavilyErrorBody;
  } catch {
    throw new Error(`Tavily returned non-JSON response: ${stdout.slice(0, 500)}`);
  }

  if (!("results" in parsed)) {
    const detail =
      typeof parsed.detail === "string"
        ? parsed.detail
        : parsed.detail?.error ?? parsed.error ?? JSON.stringify(parsed);
    throw new Error(`Tavily API error: ${detail}`);
  }
  return parsed;
}

export async function callResearch(
  config: PromptConfig,
  stageName: StageName,
  attempt = 1,
): Promise<StageOutput> {
  const response = await fetchResearch(config);
  const answer = response.answer?.trim() ?? "";
  const sources = response.results.length
    ? "\n\nSources:\n" +
      response.results
        .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`)
        .join("\n")
    : "";
  const snippets = response.results.length
    ? "\n\nSnippets:\n" +
      response.results
        .map((r, i) => `[${i + 1}] ${r.content}`)
        .join("\n\n")
    : "";

  return {
    stage: stageName,
    status: "PASS",
    content: (answer || "(no synthesized answer)") + sources + snippets,
    usage: { results: response.results.length },
    timestamp: new Date().toISOString(),
    attempt,
  };
}

// ---------------------------------------------------------------------------
// Smoke test — run with: tsx src/wrappers/research.ts --test
// Success criterion: response.results is an array with at least one item.
// ---------------------------------------------------------------------------

async function runSmokeTest(): Promise<void> {
  console.log("Research wrapper (Tavily) smoke test");
  console.log("Criterion: response.results has at least one item\n");

  if (!apiKey) {
    console.error("TAVILY_API_KEY is not set.");
    process.exit(1);
  }

  const config: PromptConfig = {
    systemPrompt:
      "You are the Analysis stage of the ASSET pipeline. Produce a brief, factual research summary with inline references to the sources you used.",
    stableContext:
      "Stable context: this is a one-shot research smoke test. Provide a 2–3 sentence answer grounded in retrievable sources.",
    variableTask:
      "In what year was the TypeScript programming language first publicly released, and which company released it?",
  };

  const response = await fetchResearch(config);
  const answer = response.answer ?? "";

  console.log(`Query               : ${response.query}`);
  console.log(`Answer length       : ${answer.length} chars`);
  console.log(`Results count       : ${response.results.length}`);
  console.log(`Response time       : ${response.response_time ?? "n/a"}s\n`);

  if (response.results.length === 0) {
    console.error("FAIL — results array is empty");
    process.exit(1);
  }

  console.log("First sources:");
  for (const r of response.results.slice(0, 3)) {
    console.log(`  - ${r.title} — ${r.url}`);
  }
  console.log("\nPASS — response includes a non-empty results array");
  process.exit(0);
}

if (process.argv.includes("--test")) {
  runSmokeTest().catch((err: unknown) => {
    console.error("Smoke test threw:", err);
    process.exit(1);
  });
}

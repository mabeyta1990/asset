import { execFile } from "node:child_process";
import type { PromptConfig, StageName, StageOutput } from "../types.js";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MAX_BUFFER = 50 * 1024 * 1024;
const MAX_TOKENS = 8192;

const apiKey = process.env.OPENAI_API_KEY ?? "";

interface OpenAIChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  id: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

interface OpenAIErrorResponse {
  error?: { message?: string; type?: string; code?: string };
}

function curlPost(body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error("OPENAI_API_KEY is not set"));
      return;
    }
    const args = [
      "-sS",
      "-X", "POST",
      ENDPOINT,
      "-H", `Authorization: Bearer ${apiKey}`,
      "-H", "Content-Type: application/json",
      "--data-binary", "@-",
    ];
    const child = execFile("curl", args, { maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`curl failed: ${err.message}; stderr: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin?.write(body);
    child.stdin?.end();
  });
}

function parseResponse(stdout: string): OpenAIResponse {
  let parsed: OpenAIResponse | OpenAIErrorResponse;
  try {
    parsed = JSON.parse(stdout) as OpenAIResponse | OpenAIErrorResponse;
  } catch {
    throw new Error(`OpenAI returned non-JSON response: ${stdout.slice(0, 500)}`);
  }
  if (!("choices" in parsed) || !Array.isArray((parsed as OpenAIResponse).choices)) {
    const msg = (parsed as OpenAIErrorResponse).error?.message ?? JSON.stringify(parsed);
    throw new Error(`OpenAI API error: ${msg}`);
  }
  return parsed as OpenAIResponse;
}

export async function callOpenAI(
  config: PromptConfig,
  stageName: StageName,
  attempt = 1,
  model = "gpt-4o",
): Promise<StageOutput> {
  const systemContent = [config.systemPrompt, config.stableContext].filter(Boolean).join("\n\n");
  const body = JSON.stringify({
    model,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: config.variableTask },
    ],
  });

  const stdout = await curlPost(body);
  const response = parseResponse(stdout);
  const content = response.choices[0]?.message.content ?? "";

  return {
    stage: stageName,
    status: "PASS",
    content,
    usage: {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    },
    timestamp: new Date().toISOString(),
    attempt,
  };
}

// ---------------------------------------------------------------------------
// Smoke test — run with: tsx src/wrappers/openai.ts --test
// ---------------------------------------------------------------------------

async function runSmokeTest(): Promise<void> {
  console.log("OpenAI wrapper smoke test");

  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(1);
  }

  const config: PromptConfig = {
    systemPrompt: "You are a TypeScript code generation assistant.",
    stableContext: "Project: Node.js 20+, ESM, TypeScript strict mode.",
    variableTask: "Write a TypeScript function that adds two numbers. Return only the code, no explanation.",
  };

  let result: StageOutput;
  try {
    result = await callOpenAI(config, "code", 1, "gpt-4o-mini");
  } catch (err) {
    console.error("Smoke test threw:", err);
    process.exit(1);
  }

  const usage = result.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  console.log(`Status           : ${result.status}`);
  console.log(`Content length   : ${result.content.length} chars`);
  console.log(`prompt_tokens    : ${usage.prompt_tokens}`);
  console.log(`completion_tokens: ${usage.completion_tokens}`);
  console.log(`total_tokens     : ${usage.total_tokens}`);
  console.log(`\nContent preview  :\n${result.content.slice(0, 400)}`);

  if (result.content.trim().length === 0) {
    console.error("FAIL — response content is empty");
    process.exit(1);
  }

  console.log("\nPASS — response content is non-empty");
  process.exit(0);
}

if (process.argv.includes("--test")) {
  runSmokeTest().catch((err: unknown) => {
    console.error("Smoke test threw:", err);
    process.exit(1);
  });
}

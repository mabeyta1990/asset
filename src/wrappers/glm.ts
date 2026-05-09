import { execFile } from "node:child_process";
import type { PromptConfig, StageName, StageOutput } from "../types.js";

const ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MODEL = "glm-4.7-flash";
const MAX_BUFFER = 50 * 1024 * 1024;
const MAX_TOKENS = 4096;

const apiKey = process.env.ZAI_API_KEY ?? "";

interface GLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GLMChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface GLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface GLMResponse {
  id: string;
  choices: GLMChoice[];
  usage: GLMUsage;
}

interface GLMErrorResponse {
  error?: { message?: string; code?: string };
}

function curlPost(body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error("ZAI_API_KEY is not set"));
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

function parseResponse(stdout: string): GLMResponse {
  let parsed: GLMResponse | GLMErrorResponse;
  try {
    parsed = JSON.parse(stdout) as GLMResponse | GLMErrorResponse;
  } catch {
    throw new Error(`GLM returned non-JSON response: ${stdout.slice(0, 500)}`);
  }
  if (!("choices" in parsed) || !Array.isArray((parsed as GLMResponse).choices)) {
    const msg =
      (parsed as GLMErrorResponse).error?.message ?? JSON.stringify(parsed);
    throw new Error(`GLM API error: ${msg}`);
  }
  return parsed as GLMResponse;
}

export async function callGLM(
  config: PromptConfig,
  stageName: StageName,
  attempt = 1,
): Promise<StageOutput> {
  const body = JSON.stringify({
    model: MODEL,
    stream: false,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: config.stableContext
          ? `${config.stableContext}\n\n${config.variableTask}`
          : config.variableTask,
      },
    ],
  });

  const stdout = await curlPost(body);
  const response = parseResponse(stdout);

  const content = response.choices[0]?.message.content ?? "";
  const usage = {
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    total_tokens: response.usage.total_tokens,
  };

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
// Smoke test — run with: tsx src/wrappers/glm.ts --test
// Success criterion: response content is non-empty
// ---------------------------------------------------------------------------

async function runSmokeTest(): Promise<void> {
  console.log("GLM wrapper (Zhipu AI) smoke test");
  console.log("Criterion: response content is non-empty\n");

  if (!apiKey) {
    console.error("ZAI_API_KEY is not set.");
    process.exit(1);
  }

  const config: PromptConfig = {
    systemPrompt:
      "You are a TypeScript code generator. Respond with only the TypeScript source — no preamble, no markdown fences, no explanation.",
    stableContext: "",
    variableTask:
      "Write a one-line TypeScript function that adds two numbers: export function add(a: number, b: number): number",
  };

  const result = await callGLM(config, "tests", 1);
  const usage = result.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number };

  console.log(`Content length  : ${result.content.length} chars`);
  console.log(`prompt_tokens   : ${usage.prompt_tokens}`);
  console.log(`completion_tokens: ${usage.completion_tokens}`);
  console.log(`total_tokens    : ${usage.total_tokens}`);
  console.log(`\nContent preview :\n${result.content.slice(0, 200)}\n`);

  if (result.content.trim().length === 0) {
    console.error("FAIL — response content is empty");
    process.exit(1);
  }

  console.log("PASS — response content is non-empty");
  process.exit(0);
}

if (process.argv.includes("--test")) {
  runSmokeTest().catch((err: unknown) => {
    console.error("Smoke test threw:", err);
    process.exit(1);
  });
}

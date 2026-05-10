import { execFile } from "node:child_process";
import type { PromptConfig, StageName, StageOutput, StageVerdict } from "../types.js";

const ENDPOINT = "https://api.deepinfra.com/v1/openai/chat/completions";
const DEFAULT_MODEL = "nvidia/Llama-3.1-Nemotron-70B-Instruct";
const MAX_BUFFER = 50 * 1024 * 1024;
const MAX_TOKENS = 8192;

const apiKey = process.env.DEEPINFRA_API_KEY ?? "";

const SYSTEM_PROMPTS: Record<"pre" | "post", string> = {
  pre: `You are a strict code auditor. Review the provided code and tests against the specification.
Provide structured feedback covering: correctness, completeness, edge cases, and test coverage.
End your response with a verdict line in exactly one of these formats:
VERDICT: PASS
VERDICT: FAIL
VERDICT: ESCALATE
Use PASS if code and tests fully satisfy the spec. Use FAIL if there are correctable issues. Use ESCALATE if the spec is ambiguous or issues require human judgment.`,

  post: `You are a strict execution auditor. Review the provided execution results against the specification.
Provide structured feedback covering: whether outputs match expected behavior, failures, and coverage gaps.
End your response with a verdict line in exactly one of these formats:
VERDICT: PASS
VERDICT: FAIL
VERDICT: ESCALATE
Use PASS if results satisfy the spec. Use FAIL if there are correctable issues. Use ESCALATE if issues require human judgment.`,
};

interface NemotronMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface NemotronChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface NemotronUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface NemotronResponse {
  id: string;
  choices: NemotronChoice[];
  usage: NemotronUsage;
}

interface NemotronErrorResponse {
  error?: { message?: string; type?: string };
}

function curlPost(body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error("DEEPINFRA_API_KEY is not set"));
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

function parseResponse(stdout: string): NemotronResponse {
  let parsed: NemotronResponse | NemotronErrorResponse;
  try {
    parsed = JSON.parse(stdout) as NemotronResponse | NemotronErrorResponse;
  } catch {
    throw new Error(`Nemotron returned non-JSON response: ${stdout.slice(0, 500)}`);
  }
  if (!("choices" in parsed) || !Array.isArray((parsed as NemotronResponse).choices)) {
    const msg =
      (parsed as NemotronErrorResponse).error?.message ?? JSON.stringify(parsed);
    throw new Error(`Nemotron API error: ${msg}`);
  }
  return parsed as NemotronResponse;
}

function extractVerdict(content: string): StageVerdict {
  const match = content.match(/VERDICT:\s*(PASS|FAIL|ESCALATE)/i);
  if (!match) return "ESCALATE";
  const v = match[1].toUpperCase();
  if (v === "PASS" || v === "FAIL" || v === "ESCALATE") return v;
  return "ESCALATE";
}

export async function callNemotronPlan(
  config: PromptConfig,
  attempt = 1,
  model = DEFAULT_MODEL,
): Promise<StageOutput> {
  const systemPrompt = "You are the Strategy stage of the ASSET pipeline. Produce a numbered implementation plan with explicit, testable acceptance criteria. Respond with the plan only.";
  const messages: NemotronMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: config.stableContext ? `${config.stableContext}\n\n${config.variableTask}` : config.variableTask },
  ];

  const body = JSON.stringify({
    model,
    stream: false,
    max_tokens: MAX_TOKENS,
    messages,
  });

  const stdout = await curlPost(body);
  const response = parseResponse(stdout);

  const content = response.choices[0]?.message.content ?? "";

  return {
    stage: "plan",
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

export async function callNemotron(
  config: PromptConfig,
  mode: "pre" | "post",
  stageName: StageName,
  attempt = 1,
  model = DEFAULT_MODEL,
): Promise<StageOutput> {
  const systemPrompt = SYSTEM_PROMPTS[mode];
  const userContent = config.stableContext
    ? `${config.stableContext}\n\n${config.variableTask}`
    : config.variableTask;

  const messages: NemotronMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const body = JSON.stringify({
    model,
    stream: false,
    max_tokens: MAX_TOKENS,
    messages,
  });

  const stdout = await curlPost(body);
  const response = parseResponse(stdout);

  const content = response.choices[0]?.message.content ?? "";
  const verdict = extractVerdict(content);
  const usage = {
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    total_tokens: response.usage.total_tokens,
  };

  return {
    stage: stageName,
    status: verdict,
    content,
    usage,
    timestamp: new Date().toISOString(),
    attempt,
  };
}

// ---------------------------------------------------------------------------
// Smoke test — run with: tsx src/wrappers/nemotron.ts --test
// Success criterion: response content is non-empty and contains a verdict
// ---------------------------------------------------------------------------

async function runSmokeTest(): Promise<void> {
  console.log("Nemotron wrapper (DeepInfra) smoke test");
  console.log("Criterion: response content is non-empty and contains a verdict\n");

  if (!apiKey) {
    console.error("DEEPINFRA_API_KEY is not set.");
    process.exit(1);
  }

  const config: PromptConfig = {
    systemPrompt: "",
    stableContext: "SPEC: Write a TypeScript function that adds two numbers and returns the result.",
    variableTask: `CODE:\nexport function add(a: number, b: number): number { return a + b; }\n\nTESTS:\ntest('add', () => { expect(add(1, 2)).toBe(3); });`,
  };

  let result: StageOutput;
  try {
    result = await callNemotron(config, "pre", "audit-pre", 1);
  } catch (err) {
    console.error("Smoke test threw:", err);
    process.exit(1);
  }

  const usage = result.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number };

  console.log(`Verdict         : ${result.status}`);
  console.log(`Content length  : ${result.content.length} chars`);
  console.log(`prompt_tokens   : ${usage.prompt_tokens}`);
  console.log(`completion_tokens: ${usage.completion_tokens}`);
  console.log(`total_tokens    : ${usage.total_tokens}`);
  console.log(`\nContent preview :\n${result.content.slice(0, 400)}\n`);

  if (result.content.trim().length === 0) {
    console.error("FAIL — response content is empty");
    process.exit(1);
  }

  const hasVerdict = /VERDICT:\s*(PASS|FAIL|ESCALATE)/i.test(result.content);
  if (!hasVerdict) {
    console.error("FAIL — response does not contain a verdict");
    process.exit(1);
  }

  console.log("PASS — response content is non-empty and contains a verdict");
  process.exit(0);
}

if (process.argv.includes("--test")) {
  runSmokeTest().catch((err: unknown) => {
    console.error("Smoke test threw:", err);
    process.exit(1);
  });
}

import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import type { PromptConfig, StageName, StageOutput, StageVerdict } from "./types.js";
import { initSession, writeStage, finalizeSession } from "./memory.js";
import { refreshCanonicalState } from "./cache/refresh.js";
import { callResearch } from "./wrappers/research.js";
import { callGemini } from "./wrappers/gemini.js";
import { callClaude } from "./wrappers/claude.js";
import { callGLM } from "./wrappers/glm.js";
import { callNemotron } from "./wrappers/nemotron.js";

const GEMINI_CACHE_NAME = "asset-canonical-context";

function runTestsInVM(): Promise<StageOutput> {
  return new Promise((resolve) => {
    execFile(
      "orb",
      [
        "run",
        "-m",
        "asset-runner",
        "bash",
        "-c",
        "cd /mnt/mac/Users/mikea/Developer/asset && ~/asset-deps/node_modules/.bin/vitest run 2>&1",
      ],
      { shell: false, timeout: 120_000 },
      (err, stdout, stderr) => {
        const content = stdout + stderr;
        const exitCode = err == null ? 0 : (typeof err.code === "number" ? err.code : 1);
        resolve({
          stage: "execution",
          status: exitCode === 0 ? "PASS" : "FAIL",
          content,
          usage: {},
          timestamp: new Date().toISOString(),
          attempt: 1,
        });
      },
    );
  });
}

async function terminate(
  sessionId: string,
  verdict: StageVerdict,
  stage: StageName,
  output: StageOutput,
): Promise<never> {
  if (verdict === "ESCALATE") {
    console.error(`[${stage}] ESCALATE: requires human review\n${output.content.slice(0, 400)}`);
  } else {
    console.error(`[${stage}] ${verdict}: ${output.content.slice(0, 400)}`);
  }
  await finalizeSession(sessionId, { verdict, summary: output.content.slice(0, 500) });
  return process.exit(verdict === "ESCALATE" ? 2 : 1);
}

export async function runPipeline(spec: string): Promise<void> {
  const sessionId = await initSession(spec);

  // Stage 0: Research (Tavily)
  const research = await callResearch(
    { systemPrompt: "", stableContext: "", variableTask: spec },
    "research",
    1,
  );
  await writeStage(sessionId, 0, "research", research);
  if (research.status !== "PASS") await terminate(sessionId, research.status, "research", research);

  // Stage 1: Plan (Gemini 2.5 Pro)
  const planConfig: PromptConfig = {
    systemPrompt:
      "You are the Strategy stage of the ASSET pipeline. Produce a numbered implementation plan with explicit, testable acceptance criteria. Respond with the plan only.",
    stableContext: research.content,
    variableTask: `Create an implementation plan for:\n\n${spec}`,
  };
  const plan = await callGemini(planConfig, "plan", 1, { displayName: GEMINI_CACHE_NAME });
  await writeStage(sessionId, 1, "plan", plan);
  if (plan.status !== "PASS") await terminate(sessionId, plan.status, "plan", plan);

  // Stage 2: Code (Claude Opus 4.7)
  const codeConfig: PromptConfig = {
    systemPrompt:
      "You are the Scripting stage of the ASSET pipeline. Produce clean, idiomatic TypeScript that satisfies the plan. Respond with only the TypeScript source — no preamble, no markdown fences.",
    stableContext: plan.content,
    variableTask: `Implement the following specification:\n\n${spec}`,
  };
  const code = await callClaude(codeConfig, "code", 1);
  await writeStage(sessionId, 2, "code", code);
  const firstBlock = code.content.match(/```(?:typescript|ts)\n([\s\S]*?)```/);
  const cleanCode = firstBlock ? firstBlock[1].trim() : code.content.replace(/```(?:typescript|ts)?\n?/g, "").replace(/```/g, "").trim();
  await writeFile("src/generated-code.ts", cleanCode, "utf8");
  if (code.status !== "PASS") await terminate(sessionId, code.status, "code", code);

  // Stage 3: Tests (GLM)
  const testsConfig: PromptConfig = {
    systemPrompt:
      "You are the Testing stage of the ASSET pipeline. Write comprehensive tests for the provided implementation. Respond with only the test source — no preamble, no markdown fences.",
    stableContext: code.content,
    variableTask: `Write tests for the following specification:\n\n${spec}`,
  };
  const tests = await callGLM(testsConfig, "tests", 1);
  await writeStage(sessionId, 3, "tests", tests);
  const fixedTests = tests.content.replace(/from ['"]\.\/\w+['"]/g, 'from "./generated-code"');
  const cleanTests = fixedTests.replace(/```(?:typescript|ts)?\n?/g, "").replace(/```/g, "").trim();
  const vitestImport = `import { describe, it, expect } from 'vitest';\n`;
  const finalTests = cleanTests.includes("from 'vitest'") || cleanTests.includes('from "vitest"')
    ? cleanTests
    : vitestImport + cleanTests;
  await writeFile("src/generated-tests.test.ts", finalTests, "utf8");
  if (tests.status !== "PASS") await terminate(sessionId, tests.status, "tests", tests);

  // Stage 4: Pre-audit (Nemotron) — systemPrompt overridden internally by mode
  const preAuditConfig: PromptConfig = {
    systemPrompt: "",
    stableContext: `SPEC:\n${spec}\n\nCODE:\n${code.content}\n\nTESTS:\n${fixedTests}`,
    variableTask: "Audit the code and tests against the specification above.",
  };
  const preAudit = await callNemotron(preAuditConfig, "pre", "audit-pre", 1);
  await writeStage(sessionId, 4, "audit-pre", preAudit);
  if (preAudit.status === "ESCALATE") await terminate(sessionId, "ESCALATE", "audit-pre", preAudit);

  // Stage 5: VM execution (OrbStack)
  const vmOutput = await runTestsInVM();
  await writeStage(sessionId, 5, "execution", vmOutput);
  if (vmOutput.status !== "PASS") await terminate(sessionId, vmOutput.status, "execution", vmOutput);

  // Stage 6: Post-audit (Nemotron) — systemPrompt overridden internally by mode
  const postAuditConfig: PromptConfig = {
    systemPrompt: "",
    stableContext: `SPEC:\n${spec}\n\nEXECUTION RESULTS:\n${vmOutput.content}`,
    variableTask: "Audit the execution results against the specification above.",
  };
  const postAudit = await callNemotron(postAuditConfig, "post", "audit-post", 1);
  await writeStage(sessionId, 6, "audit-post", postAudit);

  if (postAudit.status === "PASS") {
    await refreshCanonicalState(sessionId, GEMINI_CACHE_NAME);
    await finalizeSession(sessionId, { verdict: "PASS", summary: postAudit.content.slice(0, 500) });
  } else {
    await terminate(sessionId, postAudit.status, "audit-post", postAudit);
  }
}

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import type { ClaudeUsage, PromptConfig, StageName, StageOutput, StageVerdict, PipelineState, PipelineEvent } from "./types.js";
import { configureMemory, initSession, writeStage, finalizeSession } from "./memory.js";
import { configureRefresh, getStagingDir, promoteStagedFiles, refreshCanonicalState, deleteStaleCaches } from "./cache/refresh.js";
import { configureCanonical, readCanonicalState } from "./cache/canonical.js";
import { getRepoId, checkContextChange } from "./context-hash.js";
import { callResearch } from "./wrappers/research.js";
import { callGemini } from "./wrappers/gemini.js";
import { callClaude } from "./wrappers/claude.js";
import { callNemotron } from "./wrappers/nemotron.js";

const GEMINI_CACHE_NAME = "asset-canonical-context";
const MAX_RETRIES_CODE_GENERATION = 3;
const MAX_RETRIES_TEST_FAILURE = 3;

const REQUIRED_ENV_VARS = [
  "ANTHROPIC_API_KEY",
  "GOOGLE_AI_API_KEY",
  "TAVILY_API_KEY",
  "ZAI_API_KEY",
  "DEEPINFRA_API_KEY",
] as const;

function assertEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      "Configuration error: one or more required credentials are not set. " +
      "Check your Doppler project setup or .env file.",
    );
  }
}

export async function withTiming<T extends StageOutput>(fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const output = await fn();
  output.telemetry = { durationMs: Math.round(performance.now() - t0), usage: output.usage ?? {} };
  return output;
}

export function isClaudeUsage(u: unknown): u is ClaudeUsage {
  return typeof u === "object" && u !== null && "input_tokens" in u;
}

export function logSessionSummary(sessionId: string, startMs: number, stages: StageOutput[]): void {
  const totalDurationMs = Math.round(performance.now() - startMs);
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0;
  for (const stage of stages) {
    const u = stage.usage;
    if (isClaudeUsage(u)) {
      inputTokens += u.input_tokens;
      outputTokens += u.output_tokens;
      cacheReadTokens += u.cache_read_input_tokens;
      cacheWriteTokens += u.cache_creation_input_tokens;
    }
  }
  // Pricing: Claude Opus 4.7 per 1M tokens — input $15, output $75, cache_read $1.50, cache_write $18.75
  const estimatedCostUsd = (
    (inputTokens * 15 + cacheReadTokens * 1.5 + cacheWriteTokens * 18.75 + outputTokens * 75) / 1_000_000
  ).toFixed(4);
  console.log(
    `[session:${sessionId}] total=${totalDurationMs}ms tokens(in=${inputTokens} out=${outputTokens} cache_read=${cacheReadTokens} cache_write=${cacheWriteTokens}) est_cost=$${estimatedCostUsd}`,
  );
}

async function runTypeCheck(stagingDir: string): Promise<StageOutput> {
  const tmpTsConfig = join(stagingDir, "tsconfig.staged.json");
  await writeFile(tmpTsConfig, JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["generated-code.ts"],
  }), "utf8");

  return new Promise((resolve) => {
    execFile(
      "./node_modules/.bin/tsc",
      ["--project", tmpTsConfig],
      { shell: false, timeout: 60_000 },
      (err, stdout, stderr) => {
        const content = (stdout + stderr).trim();
        const exitCode = err == null ? 0 : (typeof err.code === "number" ? err.code : 1);
        resolve({
          stage: "type-check",
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

function parseTscDiagnostics(tscOutput: string): string {
  const errorLines = tscOutput.split("\n").filter(line => /\(\d+,\d+\): error TS\d+:/.test(line));
  return errorLines.length > 0 ? errorLines.join("\n") : tscOutput.slice(0, 2000).trim();
}

function parseVitestDiagnostics(vitestOutput: string): string {
  const lines = vitestOutput.split("\n");
  const kept: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\s*FAIL\s+/.test(line) || /⎯+ Failed Tests/.test(line)) capturing = true;
    if (/^(Test Files|Tests|Duration|Start at)\s/.test(trimmed)) { capturing = false; continue; }
    if (capturing) {
      if (/node_modules\/(vitest|@vitest)/.test(line)) continue;
      kept.push(line);
    }
  }

  while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();
  const parsed = kept.join("\n").trim();
  return parsed.length > 0 ? parsed.slice(0, 3000) : vitestOutput.slice(0, 3000).trim();
}

function buildCodeRetryTask(
  spec: string,
  currentCode: string,
  tscFeedback?: string,
  testFeedback?: string,
): string {
  const parts: string[] = [`Implement the following specification:\n\n${spec}`];
  if (tscFeedback || testFeedback) {
    parts.push(
      `\nYour previous attempt had issues. Fix all errors and return the complete corrected file.`,
      `\nCurrent code:\n\`\`\`typescript\n${currentCode}\n\`\`\``,
    );
    if (tscFeedback) parts.push(`\nTypeScript compilation errors to fix:\n\`\`\`\n${tscFeedback}\n\`\`\``);
    if (testFeedback) parts.push(`\nVitest test failures to fix:\n\`\`\`\n${testFeedback}\n\`\`\``);
  }
  parts.push(`\nReturn ONLY the corrected TypeScript source — no preamble, no markdown fences.`);
  return parts.join("\n");
}

async function refineCodeUntilTypeSafe(
  initialPromptConfig: PromptConfig,
  spec: string,
  sessionId: string,
  stagingDir: string,
  dispatchFeedback: (event: PipelineEvent) => void,
  priorCode?: string,
  priorTestFeedback?: string,
): Promise<{ codeOutput: StageOutput; cleanCode: string; typeCheckOutput: StageOutput }> {
  let attempt = 0;
  let latestCode = priorCode ?? "";
  let latestTscFeedback = "";
  let pendingTestFeedback = priorTestFeedback;
  const stagedCodePath = join(stagingDir, "generated-code.ts");

  while (true) {
    if (attempt >= MAX_RETRIES_CODE_GENERATION) {
      throw new Error(
        `Code generation exceeded ${MAX_RETRIES_CODE_GENERATION} type-check retries. Last tsc errors:\n${latestTscFeedback}`,
      );
    }

    const promptConfig: PromptConfig = (attempt === 0 && !pendingTestFeedback)
      ? initialPromptConfig
      : { ...initialPromptConfig, variableTask: buildCodeRetryTask(spec, latestCode, latestTscFeedback || undefined, pendingTestFeedback) };

    const attemptStart = performance.now();
    const codeOutput = await callClaude(promptConfig, "code", attempt + 1);
    codeOutput.telemetry = { durationMs: Math.round(performance.now() - attemptStart), usage: codeOutput.usage ?? {} };
    await writeStage(sessionId, 2, "code", codeOutput);

    if (codeOutput.status !== "PASS") {
      throw new Error(codeOutput.content);
    }

    const firstBlock = codeOutput.content.match(/```(?:typescript|ts|js)?\n([\s\S]*?)```/);
    const cleanCode = firstBlock
      ? firstBlock[1].trim()
      : codeOutput.content.replace(/```(?:typescript|ts)?\n?/g, "").replace(/```/g, "").trim();

    await writeFile(stagedCodePath, cleanCode, "utf8");

    const typeCheckOutput = await runTypeCheck(stagingDir);

    if (typeCheckOutput.status === "PASS") {
      return { codeOutput, cleanCode, typeCheckOutput };
    }

    attempt++;
    latestCode = cleanCode;
    latestTscFeedback = parseTscDiagnostics(typeCheckOutput.content);
    pendingTestFeedback = undefined;
    dispatchFeedback({ type: "TYPE_CHECK_FEEDBACK", output: typeCheckOutput, feedback: latestTscFeedback });
  }
}

function collectOutputs(state: PipelineState): Partial<Record<StageName, StageOutput>> {
  switch (state.status) {
    case "idle": return {};
    case "researching": return {};
    case "planning": return { research: state.researchOutput };
    case "coding": return { research: state.researchOutput, plan: state.planOutput };
    case "testing": return { research: state.researchOutput, plan: state.planOutput, code: state.codeOutput };
    case "auditing_pre": return { research: state.researchOutput, plan: state.planOutput, code: state.codeOutput, tests: state.testOutput };
    case "executing": return { research: state.researchOutput, plan: state.planOutput, code: state.codeOutput, tests: state.testOutput, "audit-pre": state.auditPreOutput };
    case "auditing_post": return { research: state.researchOutput, plan: state.planOutput, code: state.codeOutput, tests: state.testOutput, "audit-pre": state.auditPreOutput, execution: state.executionOutput };
    case "completed": return state.stages;
    case "failed": return state.priorOutputs;
  }
}

export function reducer(state: PipelineState, event: PipelineEvent): PipelineState {
  switch (event.type) {
    case "START":
      return { status: "researching", spec: event.spec };

    case "RESEARCH_COMPLETE":
      if (state.status !== "researching") return state;
      return { status: "planning", researchOutput: event.output };

    case "PLAN_READY":
      if (state.status !== "planning") return state;
      return { status: "coding", researchOutput: state.researchOutput, planOutput: event.output };

    case "TYPE_CHECK_FEEDBACK":
      if (state.status !== "coding") return state;
      return {
        ...state,
        attempt: (state.attempt ?? 0) + 1,
        latestFeedback: event.feedback,
        typeCheckOutput: event.output,
      };

    case "TEST_FEEDBACK":
      if (state.status !== "executing") return state;
      return {
        status: "coding",
        researchOutput: state.researchOutput,
        planOutput: state.planOutput,
        latestTestFeedback: event.feedback,
      };

    case "CODE_READY":
      if (state.status !== "coding") return state;
      return { status: "testing", researchOutput: state.researchOutput, planOutput: state.planOutput, codeOutput: event.output };

    case "TESTS_READY":
      if (state.status !== "testing") return state;
      return { status: "auditing_pre", researchOutput: state.researchOutput, planOutput: state.planOutput, codeOutput: state.codeOutput, testOutput: event.output };

    case "AUDIT_PRE_PASS":
      if (state.status !== "auditing_pre") return state;
      return { status: "executing", researchOutput: state.researchOutput, planOutput: state.planOutput, codeOutput: state.codeOutput, testOutput: state.testOutput, auditPreOutput: event.output };

    case "AUDIT_PRE_FAIL":
      if (state.status !== "auditing_pre") return state;
      return { status: "failed", failedStage: "audit-pre", error: event.output.content, priorOutputs: { research: state.researchOutput, plan: state.planOutput, code: state.codeOutput, tests: state.testOutput } };

    case "EXECUTION_COMPLETE":
      if (state.status !== "executing") return state;
      return { status: "auditing_post", researchOutput: state.researchOutput, planOutput: state.planOutput, codeOutput: state.codeOutput, testOutput: state.testOutput, auditPreOutput: state.auditPreOutput, executionOutput: event.output };

    case "AUDIT_POST_PASS":
      if (state.status !== "auditing_post") return state;
      return {
        status: "completed",
        stages: {
          research: state.researchOutput,
          plan: state.planOutput,
          code: state.codeOutput,
          tests: state.testOutput,
          "audit-pre": state.auditPreOutput,
          execution: state.executionOutput,
          "audit-post": event.output,
        },
        finalVerdict: "PASS",
      };

    case "AUDIT_POST_FAIL":
      if (state.status !== "auditing_post") return state;
      return { status: "failed", failedStage: "audit-post", error: event.output.content, priorOutputs: { research: state.researchOutput, plan: state.planOutput, code: state.codeOutput, tests: state.testOutput, "audit-pre": state.auditPreOutput, execution: state.executionOutput } };

    case "FAILURE": {
      return { status: "failed", failedStage: event.failedStage, error: event.error, priorOutputs: collectOutputs(state) };
    }
  }
}

function runTestsInVM(stagedTestPath: string): Promise<StageOutput> {
  const vmBase = "/mnt/mac/Users/mikea/Developer/asset";
  const stagingSessionDir = `${vmBase}/${dirname(stagedTestPath)}`;
  const vmTmpDir = `/tmp/vm-staging-${basename(dirname(stagedTestPath))}`;
  // sudo unshare --mount creates an isolated filesystem namespace so we can remount /mnt/mac read-only,
  // preventing test code from writing to the host outside the staging directory.
  // --net isolates the network namespace, blocking all outbound connections.
  // Files are copied to a tmpfs so vitest writes stay in VM-local ephemeral storage.
  const cmd =
    `sudo unshare --mount --net bash -c ` +
    `'mkdir -p ${vmTmpDir} && ` +
    `mount -t tmpfs tmpfs ${vmTmpDir} && ` +
    `cp ${stagingSessionDir}/generated-code.ts ${vmTmpDir}/ && ` +
    `cp ${stagingSessionDir}/generated-tests.test.ts ${vmTmpDir}/ && ` +
    `mount -o remount,ro /mnt/mac && ` +
    `cd ${vmTmpDir} && ` +
    `/home/mikea/asset-deps/node_modules/.bin/vitest run generated-tests.test.ts 2>&1'`;
  return new Promise((resolve) => {
    execFile(
      "orb",
      ["run", "-m", "asset-runner", "bash", "-c", cmd],
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
  assertEnv();
  const pipelineStart = performance.now();

  const repoId = await getRepoId();
  configureMemory(repoId);
  configureRefresh(repoId);
  configureCanonical(repoId);

  await checkContextChange(repoId, readCanonicalState, deleteStaleCaches);

  const sessionId = await initSession(spec);
  const stagingDir = join(getStagingDir(), sessionId);
  await mkdir(stagingDir, { recursive: true });

  let state: PipelineState = reducer({ status: "idle" }, { type: "START", spec });

  // Stage 0: Research (Tavily)
  const research = await withTiming(() => callResearch(
    { systemPrompt: "", stableContext: "", variableTask: spec },
    "research",
    1,
  ));
  await writeStage(sessionId, 0, "research", research);
  if (research.status !== "PASS") {
    state = reducer(state, { type: "FAILURE", failedStage: "research", error: research.content });
    await terminate(sessionId, research.status, "research", research);
  }
  state = reducer(state, { type: "RESEARCH_COMPLETE", output: research });

  // Stage 1: Plan (Gemini 2.5 Pro)
  const planConfig: PromptConfig = {
    systemPrompt:
      "You are the Strategy stage of the ASSET pipeline. Produce a numbered implementation plan with explicit, testable acceptance criteria. Respond with the plan only.",
    stableContext: research.content,
    variableTask: `Create an implementation plan for:\n\n${spec}`,
  };
  const plan = await withTiming(() => callGemini(planConfig, "plan", 1, { displayName: GEMINI_CACHE_NAME }));
  await writeStage(sessionId, 1, "plan", plan);
  if (plan.status !== "PASS") {
    state = reducer(state, { type: "FAILURE", failedStage: "plan", error: plan.content });
    await terminate(sessionId, plan.status, "plan", plan);
  }
  state = reducer(state, { type: "PLAN_READY", output: plan });

  // Base code config (reused across vitest retries)
  const codeConfig: PromptConfig = {
    systemPrompt:
      "You are the Scripting stage of the ASSET pipeline. Produce clean, idiomatic TypeScript that satisfies the plan. Respond with only the TypeScript source — no preamble, no markdown fences. Output ONLY the function implementation. No test runner, no runTests(), no TestCase interface, no console.log. Just the exported function. Do not include JSDoc usage examples with asterisks at the end of the file. Only output the function implementation.",
    stableContext: plan.content,
    variableTask: `Implement the following specification:\n\n${spec}`,
  };

  // Outer retry loop: Stages 2-5 repeat on vitest failure
  let testRetryCount = 0;
  let priorCleanCode: string | undefined;
  let latestTestFeedback: string | undefined;
  let vmOutput!: StageOutput;

  while (true) {
    // Stage 2: Code (Claude Opus 4.7 with tsc feedback-threaded retry)
    const { codeOutput: code, cleanCode } = await refineCodeUntilTypeSafe(
      codeConfig,
      spec,
      sessionId,
      stagingDir,
      (event) => { state = reducer(state, event); },
      priorCleanCode,
      latestTestFeedback,
    ).catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const failOutput: StageOutput = {
        stage: "code",
        status: "FAIL",
        content: msg,
        timestamp: new Date().toISOString(),
        attempt: MAX_RETRIES_CODE_GENERATION,
      };
      state = reducer(state, { type: "FAILURE", failedStage: "code", error: msg });
      return await terminate(sessionId, "FAIL", "code", failOutput);
    });
    state = reducer(state, { type: "CODE_READY", output: code });

    // Stage 3: Tests (GLM)
    const testsConfig: PromptConfig = {
      systemPrompt:
        "You are the Testing stage of the ASSET pipeline. Write comprehensive tests for the provided implementation. Respond with only the test source — no preamble, no markdown fences. Output ONLY vitest tests using describe, it, and expect. Import the function from ./generated-code. Do not write a custom test runner, do not use console.log, do not define a runTests function. For debounce timer tests: after the final debounced call, always advance fake timers by the full delay amount before asserting. For example, if delay is 100ms, the final vi.advanceTimersByTime() must be at least 100, not 50.",
      stableContext: cleanCode,
      variableTask: `Write tests for the following specification:\n\n${spec}`,
    };
    const tests = await withTiming(() => callClaude(testsConfig, "tests", 1));
    await writeStage(sessionId, 3, "tests", tests);
    const fixedTests = tests.content.replace(/from ['"]\.\/\w+['"]/g, 'from "./generated-code"');
    const strippedTests = fixedTests.replace(/```(?:typescript|ts)?\n?/g, "").replace(/```/g, "").trim();
    const lastDescribeEnd = strippedTests.lastIndexOf('});');
    const cleanTests = lastDescribeEnd !== -1
      ? strippedTests.slice(0, lastDescribeEnd + 3)
      : strippedTests;
    const vitestImport = `import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';\n`;
    const finalTests = cleanTests.includes("from 'vitest'") || cleanTests.includes('from "vitest"')
      ? cleanTests
      : vitestImport + cleanTests;
    const stagedTestPath = join(stagingDir, "generated-tests.test.ts");
    await writeFile(stagedTestPath, finalTests, "utf8");
    const writtenTests = await readFile(stagedTestPath, "utf8");
    const patchedTests = writtenTests
      .replace(/\btest\(/g, "it(")
      .replace(/from '@jest\/globals'/g, "from 'vitest'")
      .replace(/from "@jest\/globals"/g, 'from "vitest"')
      .replace(/\.toBe\((\d+\.\d+)\)/g, '.toBeCloseTo($1)')
      .replace(/(import\s*\{[^}]*\}\s*from\s*['"]vitest['"];\n)(\s*import\s*\{[^}]*\}\s*from\s*['"]vitest['"];\n)+/g, '$1');
    await writeFile(stagedTestPath, patchedTests, "utf8");
    if (tests.status !== "PASS") {
      state = reducer(state, { type: "FAILURE", failedStage: "tests", error: tests.content });
      await terminate(sessionId, tests.status, "tests", tests);
    }
    state = reducer(state, { type: "TESTS_READY", output: tests });

    // Stage 4: Pre-audit (Nemotron) — systemPrompt overridden internally by mode
    const preAuditConfig: PromptConfig = {
      systemPrompt: "Only return ESCALATE if the code has a security vulnerability or is fundamentally broken. Return PASS for any working implementation, even if it lacks optional features. Do not invent requirements not stated in the spec.",
      stableContext: `SPEC:\n${spec}\n\nCODE:\n${code.content}\n\nTESTS:\n${fixedTests}`,
      variableTask: "Audit the code and tests against the specification above.",
    };
    const preAudit = await withTiming(() => callNemotron(preAuditConfig, "pre", "audit-pre", 1));
    await writeStage(sessionId, 4, "audit-pre", preAudit);
    if (preAudit.status === "ESCALATE") {
      state = reducer(state, { type: "FAILURE", failedStage: "audit-pre", error: preAudit.content });
      await terminate(sessionId, "ESCALATE", "audit-pre", preAudit);
    }
    state = reducer(state, { type: "AUDIT_PRE_PASS", output: preAudit });

    // Stage 5: VM execution (OrbStack)
    vmOutput = await withTiming(() => runTestsInVM(stagedTestPath));
    await writeStage(sessionId, 5, "execution", vmOutput);

    if (vmOutput.status === "PASS") {
      state = reducer(state, { type: "EXECUTION_COMPLETE", output: vmOutput });
      break;
    }

    testRetryCount++;
    if (testRetryCount >= MAX_RETRIES_TEST_FAILURE) {
      state = reducer(state, { type: "FAILURE", failedStage: "execution", error: vmOutput.content });
      await terminate(sessionId, vmOutput.status, "execution", vmOutput);
    }

    const testFeedback = parseVitestDiagnostics(vmOutput.content);
    state = reducer(state, { type: "TEST_FEEDBACK", output: vmOutput, feedback: testFeedback });
    priorCleanCode = cleanCode;
    latestTestFeedback = testFeedback;
  }

  // Stage 6: Post-audit (Nemotron) — systemPrompt overridden internally by mode
  const postAuditConfig: PromptConfig = {
    systemPrompt: "If all tests passed in the execution output, return PASS. Only return ESCALATE if tests failed or the implementation is clearly wrong. Do not ESCALATE just because you cannot see the source code directly.",
    stableContext: `SPEC:\n${spec}\n\nEXECUTION RESULTS:\n${vmOutput.content}`,
    variableTask: "Audit the execution results against the specification above.",
  };
  const postAudit = await withTiming(() => callNemotron(postAuditConfig, "post", "audit-post", 1));
  await writeStage(sessionId, 6, "audit-post", postAudit);

  if (postAudit.status === "PASS") {
    state = reducer(state, { type: "AUDIT_POST_PASS", output: postAudit });
    const allStages = Object.values(collectOutputs(state)).filter((s): s is StageOutput => s !== undefined);
    logSessionSummary(sessionId, pipelineStart, allStages);
    await promoteStagedFiles(sessionId);
    await refreshCanonicalState(sessionId, GEMINI_CACHE_NAME);
    await finalizeSession(sessionId, { verdict: "PASS", summary: postAudit.content.slice(0, 500) });
  } else {
    state = reducer(state, { type: "AUDIT_POST_FAIL", output: postAudit });
    await terminate(sessionId, postAudit.status, "audit-post", postAudit);
  }
}

import type { PromptConfig, PromptTemplateName } from "../types.js";

// Static system prompts — cache-eligible, contain no per-run data
export const SYSTEM_PROMPTS: Record<PromptTemplateName, string> = {
  research: "",
  plan: "You are the Strategy stage of the ASSET pipeline. Produce a numbered implementation plan with explicit, testable acceptance criteria. Respond with the plan only.",
  code: "You are the Scripting stage of the ASSET pipeline. Produce clean, idiomatic TypeScript that satisfies the plan. Respond with only the TypeScript source — no preamble, no markdown fences. Output ONLY the function implementation. No test runner, no runTests(), no TestCase interface, no console.log. Just the exported function. Do not include JSDoc usage examples with asterisks at the end of the file. Only output the function implementation.",
  tests: "You are the Testing stage of the ASSET pipeline. Write comprehensive tests for the provided implementation. Respond with only the test source — no preamble, no markdown fences. Output ONLY vitest tests using describe, it, and expect. Import the function from ./generated-code. Do not write a custom test runner, do not use console.log, do not define a runTests function. For debounce timer tests: after the final debounced call, always advance fake timers by the full delay amount before asserting. For example, if delay is 100ms, the final vi.advanceTimersByTime() must be at least 100, not 50.",
  auditPre: "Verdict only — no analysis. Return one line: PASS if code compiles and has tests. Return FAIL: (1-line reason) if security/obvious runtime errors. Return ESCALATE: (1-line reason) if fundamentally broken. Never provide explanations, walkthroughs, or code review. Only the verdict.",
  auditPost: "Detailed audit after test execution. If all tests passed, return PASS. Return FAIL if tests failed or output clearly violates spec. Return ESCALATE only if results are ambiguous or require human judgment. Be thorough here.",
};

export function buildResearchConfig(spec: string): PromptConfig {
  return {
    systemPrompt: SYSTEM_PROMPTS.research,
    stableContext: "",
    variableTask: spec,
  };
}

export function buildPlanConfig(researchContent: string, spec: string): PromptConfig {
  return {
    systemPrompt: SYSTEM_PROMPTS.plan,
    stableContext: researchContent,
    variableTask: `Create an implementation plan for:\n\n${spec}`,
  };
}

export function buildCodeConfig(planContent: string, spec: string): PromptConfig {
  return {
    systemPrompt: SYSTEM_PROMPTS.code,
    stableContext: planContent,
    variableTask: `Implement the following specification:\n\n${spec}`,
  };
}

export function buildTestsConfig(cleanCode: string, spec: string): PromptConfig {
  return {
    systemPrompt: SYSTEM_PROMPTS.tests,
    stableContext: cleanCode,
    variableTask: `Write tests for the following specification:\n\n${spec}`,
  };
}

export function buildAuditPreConfig(spec: string, codeContent: string, fixedTests: string): PromptConfig {
  return {
    systemPrompt: SYSTEM_PROMPTS.auditPre,
    stableContext: `SPEC:\n${spec}\n\nCODE:\n${codeContent}\n\nTESTS:\n${fixedTests}`,
    variableTask: "Audit the code and tests against the specification above.",
  };
}

export function buildAuditPostConfig(spec: string, executionContent: string): PromptConfig {
  return {
    systemPrompt: SYSTEM_PROMPTS.auditPost,
    stableContext: `SPEC:\n${spec}\n\nEXECUTION RESULTS:\n${executionContent}`,
    variableTask: "Audit the execution results against the specification above.",
  };
}

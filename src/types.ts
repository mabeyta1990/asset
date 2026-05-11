export type StageName =
  | "research"
  | "plan"
  | "code"
  | "type-check"
  | "tests"
  | "audit-pre"
  | "execution"
  | "audit-post";

export type StageVerdict = "PASS" | "FAIL" | "ERROR" | "ESCALATE";

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface NemotronUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export type ModelUsage = ClaudeUsage | NemotronUsage | Record<string, number>;

export interface Telemetry {
  durationMs: number;
  usage: ModelUsage;
}

export interface StageOutput {
  stage: StageName;
  status: StageVerdict;
  content: string;
  usage?: ModelUsage;
  timestamp: string;
  attempt: number;
  feedback?: string;
  telemetry?: Telemetry;
  tscRetryCount?: number;
  vitestRetryCount?: number;
}

export interface SessionState {
  sessionId: string;
  spec: string;
  startedAt: string;
  completedAt?: string;
  stages: Partial<Record<StageName, StageOutput>>;
  finalVerdict?: StageVerdict;
  modelSelection?: Partial<Record<TaskStageKey, string>>;
}

export interface PromptConfig {
  systemPrompt: string;
  stableContext: string;
  variableTask: string;
}

export type PromptTemplateName = "research" | "plan" | "code" | "tests" | "auditPre" | "auditPost";

export type ModelProvider = "claude" | "gemini" | "glm" | "nemotron" | "tavily";

export type TaskStageKey = "research" | "plan" | "code" | "audit";

export type { TaskSpec } from "./types/task-spec.js";

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  priorIssues: string[];
  failedStage: StageName;
}

export type CachePointers = Record<string, string>;

export interface CanonicalState {
  codebaseHash: string;
  schemaVersion: string;
  lastUpdated: string;
  cachePointers: CachePointers;
}

export type PipelineState =
  | { status: "idle" }
  | { status: "researching"; spec: string }
  | { status: "planning"; researchOutput: StageOutput }
  | { status: "coding"; researchOutput: StageOutput; planOutput: StageOutput; attempt?: number; latestFeedback?: string; typeCheckOutput?: StageOutput; latestTestFeedback?: string }
  | { status: "testing"; researchOutput: StageOutput; planOutput: StageOutput; codeOutput: StageOutput }
  | { status: "auditing_pre"; researchOutput: StageOutput; planOutput: StageOutput; codeOutput: StageOutput; testOutput: StageOutput }
  | { status: "executing"; researchOutput: StageOutput; planOutput: StageOutput; codeOutput: StageOutput; testOutput: StageOutput; auditPreOutput: StageOutput }
  | { status: "auditing_post"; researchOutput: StageOutput; planOutput: StageOutput; codeOutput: StageOutput; testOutput: StageOutput; auditPreOutput: StageOutput; executionOutput: StageOutput }
  | { status: "completed"; stages: Partial<Record<StageName, StageOutput>>; finalVerdict: StageVerdict }
  | { status: "failed"; failedStage: StageName; error: string; priorOutputs: Partial<Record<StageName, StageOutput>> };

export type InteractiveAction = "continue" | "retry" | "abort";

export type PipelineEvent =
  | { type: "START"; spec: string }
  | { type: "RESEARCH_COMPLETE"; output: StageOutput }
  | { type: "PLAN_READY"; output: StageOutput }
  | { type: "CODE_READY"; output: StageOutput }
  | { type: "TESTS_READY"; output: StageOutput }
  | { type: "AUDIT_PRE_PASS"; output: StageOutput }
  | { type: "AUDIT_PRE_FAIL"; output: StageOutput }
  | { type: "EXECUTION_COMPLETE"; output: StageOutput }
  | { type: "AUDIT_POST_PASS"; output: StageOutput }
  | { type: "AUDIT_POST_FAIL"; output: StageOutput }
  | { type: "TYPE_CHECK_FEEDBACK"; output: StageOutput; feedback: string }
  | { type: "TEST_FEEDBACK"; output: StageOutput; feedback: string }
  | { type: "FAILURE"; failedStage: StageName; error: string };

export type StageName =
  | "research"
  | "plan"
  | "code"
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

export interface StageOutput {
  stage: StageName;
  status: StageVerdict;
  content: string;
  usage?: ClaudeUsage | Record<string, number>;
  timestamp: string;
  attempt: number;
  feedback?: string;
}

export interface SessionState {
  sessionId: string;
  spec: string;
  startedAt: string;
  completedAt?: string;
  stages: Partial<Record<StageName, StageOutput>>;
  finalVerdict?: StageVerdict;
}

export interface PromptConfig {
  systemPrompt: string;
  stableContext: string;
  variableTask: string;
}

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

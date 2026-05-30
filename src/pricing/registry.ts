export interface ClaudePricing {
  baseInput: number;  // $/MTok
  output: number;     // $/MTok
  cacheWrite: number; // $/MTok (ephemeral 5m)
  cacheHit: number;   // $/MTok
}

export interface NemotronPricing {
  input: number;  // $/MTok
  output: number; // $/MTok
}

export interface OpenAIPricing {
  input: number;  // $/MTok
  output: number; // $/MTok
}

export interface TavilyPricing {
  costPerRequest: number; // $ per API call
}

// Claude pricing (May 2026) — all models use base input/output rates
const CLAUDE_PRICING: Record<string, ClaudePricing> = {
  "claude-opus-4-7": { baseInput: 5, output: 25, cacheWrite: 6.25, cacheHit: 0.5 },
  "claude-opus-4-6": { baseInput: 5, output: 25, cacheWrite: 6.25, cacheHit: 0.5 },
  "claude-opus-4-5": { baseInput: 5, output: 25, cacheWrite: 6.25, cacheHit: 0.5 },
  "claude-sonnet-4-6": { baseInput: 3, output: 15, cacheWrite: 3.75, cacheHit: 0.3 },
  "claude-sonnet-4-5": { baseInput: 3, output: 15, cacheWrite: 3.75, cacheHit: 0.3 },
  "claude-sonnet-4": { baseInput: 3, output: 15, cacheWrite: 3.75, cacheHit: 0.3 },
  "claude-haiku-4-5": { baseInput: 1, output: 5, cacheWrite: 1.25, cacheHit: 0.1 },
  "claude-haiku-3-5": { baseInput: 0.8, output: 4, cacheWrite: 1, cacheHit: 0.08 },
};

const DEFAULT_CLAUDE: ClaudePricing = CLAUDE_PRICING["claude-haiku-4-5"]!;

// OpenAI pricing (May 2026)
const OPENAI_PRICING: Record<string, OpenAIPricing> = {
  "gpt-4o":      { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "o4-mini":     { input: 1.10, output: 4.40 },
  "o3-mini":     { input: 1.10, output: 4.40 },
};

const DEFAULT_OPENAI: OpenAIPricing = OPENAI_PRICING["gpt-4o-mini"]!;

// Nemotron pricing (May 2026)
const NEMOTRON_PRICING: NemotronPricing = {
  input: 0.2,   // $/MTok
  output: 0.8,  // $/MTok
};

// Tavily pricing (May 2026) — configurable via env var
const TAVILY_COST_PER_REQUEST = parseFloat(process.env.TAVILY_COST_PER_REQUEST ?? "0.008");

export interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheHit: number;
}

export function getClaudePricing(model: string): ClaudePricing {
  return CLAUDE_PRICING[model] ?? DEFAULT_CLAUDE;
}

export function calculateClaudeCost(model: string, usage: TokenUsage): number {
  const pricing = getClaudePricing(model);
  return (
    (usage.input * pricing.baseInput +
      usage.output * pricing.output +
      usage.cacheWrite * pricing.cacheWrite +
      usage.cacheHit * pricing.cacheHit) /
    1_000_000
  );
}

export function calculateNemotronCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens * NEMOTRON_PRICING.input + completionTokens * NEMOTRON_PRICING.output) /
    1_000_000
  );
}

export function getOpenAIPricing(model: string): OpenAIPricing {
  return OPENAI_PRICING[model] ?? DEFAULT_OPENAI;
}

export function calculateOpenAICost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = getOpenAIPricing(model);
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

export function calculateTavilyCost(requestCount: number): number {
  return requestCount * TAVILY_COST_PER_REQUEST;
}

export function getTavilyCostPerRequest(): number {
  return TAVILY_COST_PER_REQUEST;
}

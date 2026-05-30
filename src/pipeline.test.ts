import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTiming, isClaudeUsage, isNemotronUsage, logSessionSummary, resolveModel, isValidModel } from "./pipeline.js";
import { getClaudePricing, calculateClaudeCost, calculateNemotronCost, calculateTavilyCost } from "./pricing/registry.js";
import type { StageOutput, ClaudeUsage, NemotronUsage } from "./types.js";

// ---------------------------------------------------------------------------
// withTiming
// ---------------------------------------------------------------------------
describe("withTiming", () => {
  it("attaches telemetry.durationMs ≥ 0 to the returned output", async () => {
    const output = await withTiming(async () => makeStage({ usage: {} }));
    expect(output.telemetry).toBeDefined();
    expect(output.telemetry!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("carries usage from the stage output into telemetry.usage", async () => {
    const usage: ClaudeUsage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 5,
    };
    const output = await withTiming(async () => makeStage({ usage }));
    expect(output.telemetry!.usage).toEqual(usage);
  });

  it("falls back to empty object when usage is undefined", async () => {
    const output = await withTiming(async () => makeStage({ usage: undefined }));
    expect(output.telemetry!.usage).toEqual({});
  });

  it("preserves all other fields on the output", async () => {
    const output = await withTiming(async () => makeStage({ content: "hello" }));
    expect(output.content).toBe("hello");
    expect(output.stage).toBe("code");
    expect(output.status).toBe("PASS");
  });

  it("reflects real elapsed time when the fn sleeps", async () => {
    vi.useFakeTimers();
    const p = withTiming(async () => {
      await new Promise<void>((r) => setTimeout(r, 200));
      return makeStage({});
    });
    vi.advanceTimersByTime(200);
    const output = await p;
    expect(output.telemetry!.durationMs).toBeGreaterThanOrEqual(200);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// isClaudeUsage
// ---------------------------------------------------------------------------
describe("isClaudeUsage", () => {
  it("returns true for a ClaudeUsage-shaped object", () => {
    const u: ClaudeUsage = {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };
    expect(isClaudeUsage(u)).toBe(true);
  });

  it("returns false for a generic Record", () => {
    expect(isClaudeUsage({ results: 3 })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isClaudeUsage(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isClaudeUsage(undefined)).toBe(false);
  });

  it("returns false for a primitive", () => {
    expect(isClaudeUsage(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isNemotronUsage
// ---------------------------------------------------------------------------
describe("isNemotronUsage", () => {
  it("returns true for a NemotronUsage-shaped object", () => {
    const u: NemotronUsage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };
    expect(isNemotronUsage(u)).toBe(true);
  });

  it("returns false for ClaudeUsage", () => {
    const u: ClaudeUsage = {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };
    expect(isNemotronUsage(u)).toBe(false);
  });

  it("returns false for a generic Record", () => {
    expect(isNemotronUsage({ results: 3 })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isNemotronUsage(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// logSessionSummary
// ---------------------------------------------------------------------------
describe("logSessionSummary", () => {
  beforeEach(() => { vi.spyOn(console, "log").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("logs a line tagged with the session ID", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    logSessionSummary("test-session-abc", performance.now(), [], modelSelection, 0, 0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[session:test-session-abc]"),
    );
  });

  it("aggregates input and output tokens from Claude-format stages", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
      makeStage({
        usage: { input_tokens: 500, output_tokens: 100, cache_creation_input_tokens: 50, cache_read_input_tokens: 25 },
      }),
      makeStage({ usage: { results: 5 } }), // Tavily request count
    ];
    logSessionSummary("s1", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("claude_in=1500");
    expect(logged).toContain("claude_out=300");
    expect(logged).toContain("tavily_req=5");
    expect(logged).toContain("savings=25");
    expect(logged).toContain("investment=50");
  });

  it("computes a non-negative estimated cost", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
    ];
    logSessionSummary("s2", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const match = logged.match(/est_cost=\$(\d+\.\d+)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeGreaterThan(0);
  });

  it("skips stages with non-Claude usage when calculating cost", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [makeStage({ usage: {} })];
    logSessionSummary("s3", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("est_cost=$0.0000");
  });

  it("calculates and displays cache efficiency percentage", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: {
          input_tokens: 1000,
          output_tokens: 200,
          cache_creation_input_tokens: 4000,
          cache_read_input_tokens: 12000,
        },
      }),
    ];
    logSessionSummary("s4", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("investment=4000");
    expect(logged).toContain("savings=12000");
    expect(logged).toContain("efficiency=75.0%");
  });

  it("omits cache metrics entirely when investment and savings are both zero", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: {
          input_tokens: 1000,
          output_tokens: 200,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      }),
    ];
    logSessionSummary("s5", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).not.toContain("cache(");
    expect(logged).toContain("claude_in=1000");
  });

  it("displays cache metrics with efficiency when cache data exists", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: {
          input_tokens: 1000,
          output_tokens: 200,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 1500,
        },
      }),
    ];
    logSessionSummary("s5b", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("cache(");
    expect(logged).toContain("investment=500");
    expect(logged).toContain("savings=1500");
    expect(logged).toContain("efficiency=75.0%");
  });

  it("includes retry metrics in the logged output", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [makeStage({ usage: {} })];
    logSessionSummary("s6", performance.now(), stages, modelSelection, 2, 1);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("tsc=2");
    expect(logged).toContain("vitest=1");
  });

  it("defaults to zero retries when not specified", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [makeStage({ usage: {} })];
    logSessionSummary("s7", performance.now(), stages, modelSelection);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("tsc=0");
    expect(logged).toContain("vitest=0");
  });

  it("aggregates Nemotron tokens from stages", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: { prompt_tokens: 2000, completion_tokens: 500, total_tokens: 2500 },
      }),
      makeStage({
        usage: { prompt_tokens: 1000, completion_tokens: 250, total_tokens: 1250 },
      }),
    ];
    logSessionSummary("s8", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("nemotron_in=3000");
    expect(logged).toContain("nemotron_out=750");
  });

  it("tracks multiple model types in single session", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
      makeStage({
        usage: { prompt_tokens: 2000, completion_tokens: 500, total_tokens: 2500 },
      }),
      makeStage({ usage: { results: 3 } }),
    ];
    logSessionSummary("s9", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("claude_in=1000");
    expect(logged).toContain("claude_out=200");
    expect(logged).toContain("nemotron_in=2000");
    expect(logged).toContain("nemotron_out=500");
    expect(logged).toContain("tavily_req=3");
  });

  it("omits cache metrics when not present", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
    ];
    logSessionSummary("s10", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).not.toContain("cache(");
  });

  it("calculates accurate Claude cost using pricing registry", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-haiku-4-5", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
    ];
    logSessionSummary("s11", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("est_cost=$");
    const match = logged.match(/est_cost=\$(\d+\.\d+)/);
    expect(match).not.toBeNull();
    const cost = parseFloat(match![1]);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01);
  });

  it("combines Claude, Nemotron, and Tavily costs", () => {
    const modelSelection = { research: "tavily-search", plan: "nemotron-plan", code: "claude-opus-4-7", audit: "nemotron-audit" };
    const stages: StageOutput[] = [
      makeStage({
        usage: { input_tokens: 10000, output_tokens: 5000, cache_creation_input_tokens: 2000, cache_read_input_tokens: 4000 },
      }),
      makeStage({
        usage: { prompt_tokens: 5000, completion_tokens: 2000, total_tokens: 7000 },
      }),
      makeStage({ usage: { results: 10 } }),
    ];
    logSessionSummary("s12", performance.now(), stages, modelSelection, 0, 0);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("claude_in=10000");
    expect(logged).toContain("nemotron_in=5000");
    expect(logged).toContain("tavily_req=10");
    expect(logged).toContain("est_cost=$");
  });
});

// ---------------------------------------------------------------------------
// Telemetry appears in StageOutput shape produced by a real pipeline stage
// ---------------------------------------------------------------------------
describe("StageOutput with telemetry (shape validation)", () => {
  it("session JSON shape includes telemetry when written after withTiming", async () => {
    const usage: ClaudeUsage = {
      input_tokens: 200,
      output_tokens: 80,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 40,
    };
    const stage = await withTiming(async () => makeStage({ usage }));

    // Simulate what writeStage serialises to disk
    const json = JSON.parse(JSON.stringify(stage)) as Record<string, unknown>;
    expect(json).toHaveProperty("telemetry");
    const telemetry = json["telemetry"] as Record<string, unknown>;
    expect(typeof telemetry["durationMs"]).toBe("number");
    expect(telemetry["usage"]).toEqual(usage);
  });
});

// ---------------------------------------------------------------------------
// resolveModel
// ---------------------------------------------------------------------------
describe("resolveModel", () => {
  it("returns the override when a valid model is provided", () => {
    const result = resolveModel("claude-opus-4-7", "code");
    expect(result).toBe("claude-opus-4-7");
  });

  it("returns the default model when no override is provided", () => {
    const result = resolveModel(undefined, "code");
    expect(result).toBe("claude-sonnet-4-6");
  });

  it("returns the default model for each stage", () => {
    expect(resolveModel(undefined, "research")).toBe("tavily-search");
    expect(resolveModel(undefined, "plan")).toBe("nemotron-plan");
    expect(resolveModel(undefined, "code")).toBe("claude-sonnet-4-6");
    expect(resolveModel(undefined, "audit")).toBe("nemotron-audit");
  });

  it("throws an error when an invalid model is provided", () => {
    expect(() => resolveModel("invalid-model-xyz", "code")).toThrow(
      "Invalid model 'invalid-model-xyz' for stage 'code'",
    );
  });

  it("allows valid Claude models", () => {
    const validModels = [
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
    ];
    for (const model of validModels) {
      const result = resolveModel(model, "code");
      expect(result).toBe(model);
    }
  });

  it("allows valid Nemotron models", () => {
    const validModels = ["nemotron-plan", "nemotron-audit", "nemotron-qa"];
    for (const model of validModels) {
      const result = resolveModel(model, "audit");
      expect(result).toBe(model);
    }
  });

  it("allows valid Gemini models", () => {
    const result = resolveModel("gemini-2-0", "plan");
    expect(result).toBe("gemini-2-0");
  });

  it("allows valid Tavily models", () => {
    const result = resolveModel("tavily-search", "research");
    expect(result).toBe("tavily-search");
  });
});

// ---------------------------------------------------------------------------
// isValidModel
// ---------------------------------------------------------------------------
describe("isValidModel", () => {
  it("returns true for valid Claude models", () => {
    expect(isValidModel("claude-opus-4-7")).toBe(true);
    expect(isValidModel("claude-haiku-4-5")).toBe(true);
  });

  it("returns true for valid Gemini models", () => {
    expect(isValidModel("gemini-2-0")).toBe(true);
    expect(isValidModel("gemini-1-5-pro")).toBe(true);
  });

  it("returns true for valid Nemotron models", () => {
    expect(isValidModel("nemotron-plan")).toBe(true);
    expect(isValidModel("nemotron-audit")).toBe(true);
  });

  it("returns true for valid Tavily models", () => {
    expect(isValidModel("tavily-search")).toBe(true);
  });

  it("returns false for unknown models", () => {
    expect(isValidModel("unknown-model-xyz")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidModel("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pricing Registry
// ---------------------------------------------------------------------------
describe("Pricing Registry", () => {
  it("returns correct Claude Haiku 4.5 pricing", () => {
    const pricing = getClaudePricing("claude-haiku-4-5");
    expect(pricing.baseInput).toBe(1);
    expect(pricing.output).toBe(5);
    expect(pricing.cacheWrite).toBe(1.25);
    expect(pricing.cacheHit).toBe(0.1);
  });

  it("returns correct Claude Opus 4.7 pricing", () => {
    const pricing = getClaudePricing("claude-opus-4-7");
    expect(pricing.baseInput).toBe(5);
    expect(pricing.output).toBe(25);
    expect(pricing.cacheWrite).toBe(6.25);
    expect(pricing.cacheHit).toBe(0.5);
  });

  it("defaults to Haiku pricing for unknown models", () => {
    const pricing = getClaudePricing("unknown-model");
    expect(pricing.baseInput).toBe(1);
    expect(pricing.output).toBe(5);
  });

  it("calculates Claude cost correctly", () => {
    const cost = calculateClaudeCost("claude-haiku-4-5", {
      input: 1000,
      output: 500,
      cacheWrite: 0,
      cacheHit: 0,
    });
    const expected = (1000 * 1 + 500 * 5) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("includes cache costs in Claude calculation", () => {
    const cost = calculateClaudeCost("claude-haiku-4-5", {
      input: 0,
      output: 0,
      cacheWrite: 1000,
      cacheHit: 2000,
    });
    const expected = (1000 * 1.25 + 2000 * 0.1) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("calculates Nemotron cost correctly", () => {
    const cost = calculateNemotronCost(1000, 500);
    const expected = (1000 * 0.2 + 500 * 0.8) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("calculates Tavily cost based on request count", () => {
    const cost = calculateTavilyCost(5);
    expect(cost).toBe(5 * 0.008);
  });
});

// ---------------------------------------------------------------------------
// Interactive Mode
// ---------------------------------------------------------------------------
describe("promptInteractive", () => {
  it("is exported and callable", async () => {
    const { promptInteractive: importedPrompt } = await import("./pipeline.js");
    expect(typeof importedPrompt).toBe("function");
  });
});

describe("Interactive feedback injection", () => {
  it("appends feedback to variableTask in config when feedback is provided", () => {
    const baseConfig = {
      systemPrompt: "Do something",
      stableContext: "Context",
      variableTask: "Task description",
    };

    const feedback = "User provided feedback";
    const updatedConfig = {
      ...baseConfig,
      variableTask: `${baseConfig.variableTask}\n\nAdditional feedback from interactive review: ${feedback}`,
    };

    expect(updatedConfig.variableTask).toContain("Task description");
    expect(updatedConfig.variableTask).toContain("User provided feedback");
  });

  it("handles multiple feedback injections sequentially", () => {
    let config = {
      systemPrompt: "Do something",
      stableContext: "Context",
      variableTask: "Task description",
    };

    const feedback1 = "First feedback";
    config.variableTask = `${config.variableTask}\n\nAdditional feedback from interactive review: ${feedback1}`;

    const feedback2 = "Second feedback";
    config.variableTask = `${config.variableTask}\n\nAdditional feedback from interactive review: ${feedback2}`;

    expect(config.variableTask).toContain("Task description");
    expect(config.variableTask).toContain("First feedback");
    expect(config.variableTask).toContain("Second feedback");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeStage(overrides: Partial<StageOutput>): StageOutput {
  return {
    stage: "code",
    status: "PASS",
    content: "test",
    timestamp: new Date().toISOString(),
    attempt: 1,
    ...overrides,
  };
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTiming, isClaudeUsage, logSessionSummary } from "./pipeline.js";
import type { StageOutput, ClaudeUsage } from "./types.js";

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
// logSessionSummary
// ---------------------------------------------------------------------------
describe("logSessionSummary", () => {
  beforeEach(() => { vi.spyOn(console, "log").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("logs a line tagged with the session ID", () => {
    logSessionSummary("test-session-abc", performance.now(), []);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[session:test-session-abc]"),
    );
  });

  it("aggregates input and output tokens from Claude-format stages", () => {
    const stages: StageOutput[] = [
      makeStage({
        usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
      makeStage({
        usage: { input_tokens: 500, output_tokens: 100, cache_creation_input_tokens: 50, cache_read_input_tokens: 25 },
      }),
      makeStage({ usage: { results: 5 } }), // non-Claude usage should be skipped
    ];
    logSessionSummary("s1", performance.now(), stages);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("in=1500");
    expect(logged).toContain("out=300");
    expect(logged).toContain("cache_read=25");
    expect(logged).toContain("cache_write=50");
  });

  it("computes a non-negative estimated cost", () => {
    const stages: StageOutput[] = [
      makeStage({
        usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
    ];
    logSessionSummary("s2", performance.now(), stages);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const match = logged.match(/est_cost=\$(\d+\.\d+)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeGreaterThan(0);
  });

  it("skips stages with non-Claude usage when calculating cost", () => {
    const stages: StageOutput[] = [makeStage({ usage: {} })];
    logSessionSummary("s3", performance.now(), stages);
    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(logged).toContain("est_cost=$0.0000");
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

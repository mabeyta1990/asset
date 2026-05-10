import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { SessionState } from "../types.js";
import { aggregateCosts, formatCostBreakdown } from "./aggregator.js";

describe("aggregateCosts", () => {
  const testDir = "./test-sessions-temp";

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return empty breakdown for non-existent directory", async () => {
    const result = await aggregateCosts("./non-existent-dir");
    expect(result.total).toBe(0);
    expect(Object.keys(result.byModel).length).toBe(0);
  });

  it("should aggregate Claude costs correctly", async () => {
    const sessionId = "2026-05-10T12-00-00-000Z";
    const sessionDir = join(testDir, sessionId);
    await mkdir(sessionDir);

    const session: SessionState = {
      sessionId,
      spec: "Test task",
      startedAt: "2026-05-10T12:00:00Z",
      stages: {
        code: {
          stage: "code",
          status: "PASS",
          content: "test",
          timestamp: "2026-05-10T12:00:00Z",
          attempt: 1,
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          telemetry: {
            durationMs: 1000,
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
          },
        },
      },
      modelSelection: {
        code: "claude-haiku-4-5",
      },
    };

    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify(session, null, 2)
    );

    const result = await aggregateCosts(testDir);

    // claude-haiku-4-5: input $1, output $5 per MTok
    // cost = (1000 * 1 + 500 * 5) / 1,000,000 = (1000 + 2500) / 1,000,000 = 0.0035
    expect(result.total).toBeCloseTo(0.0035, 5);
    expect(result.byModel["claude-haiku-4-5"]).toBeCloseTo(0.0035, 5);
    expect(result.byStage["code"]).toBeCloseTo(0.0035, 5);
    expect(result.byTaskId["Test task"]).toBeCloseTo(0.0035, 5);
  });

  it("should aggregate Nemotron costs correctly", async () => {
    const sessionId = "2026-05-10T12-00-01-000Z";
    const sessionDir = join(testDir, sessionId);
    await mkdir(sessionDir);

    const session: SessionState = {
      sessionId,
      spec: "Another test",
      startedAt: "2026-05-10T12:00:01Z",
      stages: {
        plan: {
          stage: "plan",
          status: "PASS",
          content: "test plan",
          timestamp: "2026-05-10T12:00:01Z",
          attempt: 1,
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 500,
            total_tokens: 1500,
          },
          telemetry: {
            durationMs: 1000,
            usage: {
              prompt_tokens: 1000,
              completion_tokens: 500,
              total_tokens: 1500,
            },
          },
        },
      },
      modelSelection: {
        plan: "nemotron-plan",
      },
    };

    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify(session, null, 2)
    );

    const result = await aggregateCosts(testDir);

    // nemotron: input $0.2, output $0.8 per MTok
    // cost = (1000 * 0.2 + 500 * 0.8) / 1,000,000 = (200 + 400) / 1,000,000 = 0.0006
    expect(result.total).toBeCloseTo(0.0006, 5);
    expect(result.byModel["nemotron-plan"]).toBeCloseTo(0.0006, 5);
    expect(result.byStage["plan"]).toBeCloseTo(0.0006, 5);
  });

  it("should aggregate Tavily costs correctly", async () => {
    const sessionId = "2026-05-10T12-00-02-000Z";
    const sessionDir = join(testDir, sessionId);
    await mkdir(sessionDir);

    const session: SessionState = {
      sessionId,
      spec: "Search test",
      startedAt: "2026-05-10T12:00:02Z",
      stages: {
        research: {
          stage: "research",
          status: "PASS",
          content: "test research",
          timestamp: "2026-05-10T12:00:02Z",
          attempt: 1,
          usage: { results: 5 },
          telemetry: {
            durationMs: 500,
            usage: { results: 5 },
          },
        },
      },
      modelSelection: {
        research: "tavily-search",
      },
    };

    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify(session, null, 2)
    );

    const result = await aggregateCosts(testDir);

    // tavily: $0.008 per request, 5 results
    // cost = 5 * 0.008 = 0.04
    expect(result.total).toBeCloseTo(0.04, 5);
    expect(result.byModel["tavily-search"]).toBeCloseTo(0.04, 5);
    expect(result.byStage["research"]).toBeCloseTo(0.04, 5);
  });

  it("should handle multiple stages in a single session", async () => {
    const sessionId = "2026-05-10T12-00-03-000Z";
    const sessionDir = join(testDir, sessionId);
    await mkdir(sessionDir);

    const session: SessionState = {
      sessionId,
      spec: "Multi-stage task",
      startedAt: "2026-05-10T12:00:03Z",
      stages: {
        code: {
          stage: "code",
          status: "PASS",
          content: "code",
          timestamp: "2026-05-10T12:00:03Z",
          attempt: 1,
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          telemetry: {
            durationMs: 1000,
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
          },
        },
        plan: {
          stage: "plan",
          status: "PASS",
          content: "plan",
          timestamp: "2026-05-10T12:00:03Z",
          attempt: 1,
          usage: {
            prompt_tokens: 500,
            completion_tokens: 250,
            total_tokens: 750,
          },
          telemetry: {
            durationMs: 500,
            usage: {
              prompt_tokens: 500,
              completion_tokens: 250,
              total_tokens: 750,
            },
          },
        },
      },
      modelSelection: {
        code: "claude-haiku-4-5",
        plan: "nemotron-plan",
      },
    };

    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify(session, null, 2)
    );

    const result = await aggregateCosts(testDir);

    // claude cost: (1000 * 1 + 500 * 5) / 1,000,000 = 0.0035
    // nemotron cost: (500 * 0.2 + 250 * 0.8) / 1,000,000 = 0.0003
    // total: 0.0038
    expect(result.total).toBeCloseTo(0.0035 + 0.0003, 5);
    expect(result.byModel["claude-haiku-4-5"]).toBeCloseTo(0.0035, 5);
    expect(result.byModel["nemotron-plan"]).toBeCloseTo(0.0003, 5);
    expect(result.byStage["code"]).toBeCloseTo(0.0035, 5);
    expect(result.byStage["plan"]).toBeCloseTo(0.0003, 5);
  });

  it("should skip sessions without modelSelection", async () => {
    const sessionId = "2026-05-10T12-00-04-000Z";
    const sessionDir = join(testDir, sessionId);
    await mkdir(sessionDir);

    const session: SessionState = {
      sessionId,
      spec: "No model selection",
      startedAt: "2026-05-10T12:00:04Z",
      stages: {
        code: {
          stage: "code",
          status: "PASS",
          content: "code",
          timestamp: "2026-05-10T12:00:04Z",
          attempt: 1,
          telemetry: {
            durationMs: 1000,
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
          },
        },
      },
    };

    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify(session, null, 2)
    );

    const result = await aggregateCosts(testDir);

    expect(result.total).toBe(0);
  });

  it("should skip sessions with malformed JSON", async () => {
    const sessionId = "2026-05-10T12-00-05-000Z";
    const sessionDir = join(testDir, sessionId);
    await mkdir(sessionDir);

    await writeFile(
      join(sessionDir, "session.json"),
      "{ invalid json"
    );

    const result = await aggregateCosts(testDir);

    expect(result.total).toBe(0);
  });

  it("should handle cache write and cache hit tokens", async () => {
    const sessionId = "2026-05-10T12-00-06-000Z";
    const sessionDir = join(testDir, sessionId);
    await mkdir(sessionDir);

    const session: SessionState = {
      sessionId,
      spec: "Cache test",
      startedAt: "2026-05-10T12:00:06Z",
      stages: {
        code: {
          stage: "code",
          status: "PASS",
          content: "code",
          timestamp: "2026-05-10T12:00:06Z",
          attempt: 1,
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 200,
          },
          telemetry: {
            durationMs: 1000,
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
              cache_creation_input_tokens: 100,
              cache_read_input_tokens: 200,
            },
          },
        },
      },
      modelSelection: {
        code: "claude-haiku-4-5",
      },
    };

    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify(session, null, 2)
    );

    const result = await aggregateCosts(testDir);

    // claude-haiku-4-5: baseInput $1, output $5, cacheWrite $1.25, cacheHit $0.1 per MTok
    // cost = (1000 * 1 + 500 * 5 + 100 * 1.25 + 200 * 0.1) / 1,000,000
    //      = (1000 + 2500 + 125 + 20) / 1,000,000 = 0.003645
    expect(result.total).toBeCloseTo(0.003645, 5);
  });
});

describe("formatCostBreakdown", () => {
  it("should format empty breakdown", () => {
    const breakdown = {
      byModel: {},
      byStage: {},
      byTaskId: {},
      total: 0,
    };

    const formatted = formatCostBreakdown(breakdown);
    expect(formatted).toContain("Total Cost: $0.0000");
  });

  it("should format breakdown with costs", () => {
    const breakdown = {
      byModel: {
        "claude-haiku-4-5": 0.0035,
        "nemotron-plan": 0.0006,
      },
      byStage: {
        code: 0.0035,
        plan: 0.0006,
      },
      byTaskId: {
        "Test task": 0.0041,
      },
      total: 0.0041,
    };

    const formatted = formatCostBreakdown(breakdown);
    expect(formatted).toContain("Total Cost: $0.0041");
    expect(formatted).toContain("By Model:");
    expect(formatted).toContain("claude-haiku-4-5: $0.0035");
    expect(formatted).toContain("nemotron-plan: $0.0006");
    expect(formatted).toContain("By Stage:");
    expect(formatted).toContain("code: $0.0035");
    expect(formatted).toContain("By Task:");
    expect(formatted).toContain("Test task: $0.0041");
  });

  it("should truncate long task IDs", () => {
    const longTaskId = "a".repeat(100);
    const breakdown = {
      byModel: {},
      byStage: {},
      byTaskId: { [longTaskId]: 0.001 },
      total: 0.001,
    };

    const formatted = formatCostBreakdown(breakdown);
    expect(formatted).toContain("...");
    expect(formatted).not.toContain(longTaskId);
  });

  it("should sort by cost descending", () => {
    const breakdown = {
      byModel: {
        "model-a": 0.001,
        "model-b": 0.005,
        "model-c": 0.002,
      },
      byStage: {},
      byTaskId: {},
      total: 0.008,
    };

    const formatted = formatCostBreakdown(breakdown);
    const lines = formatted.split("\n");
    const modelIndex = lines.findIndex((l) => l.includes("By Model:"));
    expect(lines[modelIndex + 1]).toContain("model-b");
    expect(lines[modelIndex + 2]).toContain("model-c");
    expect(lines[modelIndex + 3]).toContain("model-a");
  });
});

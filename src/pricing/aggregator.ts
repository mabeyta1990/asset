import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SessionState, TaskStageKey } from "../types.js";
import { isClaudeUsage, isNemotronUsage } from "../pipeline.js";
import { getClaudePricing, calculateClaudeCost, calculateNemotronCost, calculateTavilyCost } from "./registry.js";

export interface CostBreakdown {
  byModel: Record<string, number>;
  byStage: Record<string, number>;
  byTaskId: Record<string, number>;
  total: number;
}

export async function aggregateCosts(sessionsDir: string): Promise<CostBreakdown> {
  const breakdown: CostBreakdown = {
    byModel: {},
    byStage: {},
    byTaskId: {},
    total: 0,
  };

  try {
    const sessionDirs = await readdir(sessionsDir, { withFileTypes: true });

    for (const entry of sessionDirs) {
      if (!entry.isDirectory()) continue;

      const sessionPath = join(sessionsDir, entry.name);
      const sessionFile = join(sessionPath, "session.json");

      try {
        const content = await readFile(sessionFile, "utf8");
        const session = JSON.parse(content) as SessionState;

        // Extract task ID from spec (first line or entire spec)
        const taskId = session.spec.split("\n")[0].slice(0, 50);

        // Map stage names to model selection keys
        const stageToModelKey: Record<string, TaskStageKey> = {
          research: "research",
          plan: "plan",
          code: "code",
          "type-check": "code",
          tests: "code",
          "audit-pre": "audit",
          "audit-post": "audit",
          execution: "audit", // execution stage may use audit model
        };

        // Process each stage
        for (const [stageName, stageOutput] of Object.entries(session.stages)) {
          if (!stageOutput?.telemetry?.usage) continue;

          const usage = stageOutput.telemetry.usage;
          let stageCost = 0;

          // Determine the model used for this stage
          const modelKey = stageToModelKey[stageName];
          if (!modelKey) continue;

          const modelForStage = session.modelSelection?.[modelKey];
          if (!modelForStage) continue;

          // Calculate cost based on model type
          if (modelForStage.startsWith("claude-")) {
            if (isClaudeUsage(usage)) {
              stageCost = calculateClaudeCost(modelForStage, {
                input: usage.input_tokens,
                output: usage.output_tokens,
                cacheWrite: usage.cache_creation_input_tokens,
                cacheHit: usage.cache_read_input_tokens,
              });
            }
          } else if (modelForStage.startsWith("nemotron-")) {
            if (isNemotronUsage(usage)) {
              stageCost = calculateNemotronCost(usage.prompt_tokens, usage.completion_tokens);
            }
          } else if (modelForStage === "tavily-search") {
            // Tavily costs are per request, stored as "results" count
            if (typeof usage === "object" && usage !== null && "results" in usage) {
              stageCost = calculateTavilyCost((usage as Record<string, number>).results ?? 0);
            }
          }

          // Aggregate costs
          if (stageCost > 0) {
            breakdown.byModel[modelForStage] = (breakdown.byModel[modelForStage] ?? 0) + stageCost;
            breakdown.byStage[stageName] = (breakdown.byStage[stageName] ?? 0) + stageCost;
            breakdown.byTaskId[taskId] = (breakdown.byTaskId[taskId] ?? 0) + stageCost;
            breakdown.total += stageCost;
          }
        }
      } catch (err) {
        // Skip sessions that can't be read or parsed
        continue;
      }
    }
  } catch (err) {
    // If sessions directory doesn't exist or can't be read, return empty breakdown
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  return breakdown;
}

export function formatCostBreakdown(breakdown: CostBreakdown): string {
  const lines: string[] = [];

  lines.push("=== Cost Breakdown ===\n");

  // Total cost
  lines.push(`Total Cost: $${breakdown.total.toFixed(4)}`);
  lines.push("");

  // By model
  if (Object.keys(breakdown.byModel).length > 0) {
    lines.push("By Model:");
    const sortedModels = Object.entries(breakdown.byModel)
      .sort((a, b) => b[1] - a[1]);
    for (const [model, cost] of sortedModels) {
      lines.push(`  ${model}: $${cost.toFixed(4)}`);
    }
    lines.push("");
  }

  // By stage
  if (Object.keys(breakdown.byStage).length > 0) {
    lines.push("By Stage:");
    const sortedStages = Object.entries(breakdown.byStage)
      .sort((a, b) => b[1] - a[1]);
    for (const [stage, cost] of sortedStages) {
      lines.push(`  ${stage}: $${cost.toFixed(4)}`);
    }
    lines.push("");
  }

  // By task ID
  if (Object.keys(breakdown.byTaskId).length > 0) {
    lines.push("By Task:");
    const sortedTasks = Object.entries(breakdown.byTaskId)
      .sort((a, b) => b[1] - a[1]);
    for (const [taskId, cost] of sortedTasks) {
      const displayId = taskId.length > 60 ? taskId.slice(0, 57) + "..." : taskId;
      lines.push(`  ${displayId}: $${cost.toFixed(4)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

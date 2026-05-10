import { readFile } from "node:fs/promises";
import { runPipeline } from "../pipeline.js";
import { getRepoId } from "../context-hash.js";
import { aggregateCosts, formatCostBreakdown } from "../pricing/aggregator.js";
import type { TaskSpec, TaskStageKey } from "../types.js";

interface CliArgs {
  command?: string;
  input?: string;
  interactive: boolean;
  modelOverrides: Partial<Record<TaskStageKey, string>>;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: asset <spec> [--interactive] [--model-code MODEL] [--model-plan MODEL] [--model-research MODEL] [--model-audit MODEL]");
    console.error("       asset cost --summary");
    process.exit(1);
  }

  const firstArg = args[0].trim();

  // Check for cost subcommand
  if (firstArg === "cost" && args[1] === "--summary") {
    return { command: "cost", interactive: false, modelOverrides: {} };
  }

  const input = firstArg;
  const modelOverrides: Partial<Record<TaskStageKey, string>> = {};
  let interactive = false;

  // Parse optional model override flags
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--interactive") {
      interactive = true;
    } else if (arg === "--model-code" && i + 1 < args.length) {
      modelOverrides.code = args[++i];
    } else if (arg === "--model-plan" && i + 1 < args.length) {
      modelOverrides.plan = args[++i];
    } else if (arg === "--model-research" && i + 1 < args.length) {
      modelOverrides.research = args[++i];
    } else if (arg === "--model-audit" && i + 1 < args.length) {
      modelOverrides.audit = args[++i];
    } else if (arg.startsWith("--model-")) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }

  return { input, interactive, modelOverrides };
}

async function main(): Promise<void> {
  const { command, input, interactive, modelOverrides } = parseArgs();

  // Handle cost subcommand
  if (command === "cost") {
    try {
      const repoId = await getRepoId();
      const sessionsDir = `.ai-memory/${repoId}/sessions`;
      const breakdown = await aggregateCosts(sessionsDir);
      console.log(formatCostBreakdown(breakdown));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Cost aggregation error:", msg);
      process.exit(1);
    }
    return;
  }

  if (!input) {
    console.error("Usage: asset <spec> [--interactive] [--model-code MODEL] [--model-plan MODEL] [--model-research MODEL] [--model-audit MODEL]");
    console.error("       asset cost --summary");
    process.exit(1);
  }

  let taskOrSpec: string | TaskSpec;

  // Check if input looks like a file path (ends with .json) or is a plain string
  if (input.endsWith(".json")) {
    try {
      const content = await readFile(input, "utf8");
      const parsed = JSON.parse(content) as TaskSpec;
      // Apply CLI model overrides to TaskSpec
      taskOrSpec = {
        ...parsed,
        models: { ...parsed.models, ...modelOverrides },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to read or parse TaskSpec JSON at ${input}: ${msg}`);
      process.exit(1);
    }
  } else {
    // Treat as a plain spec string, create a TaskSpec with model overrides
    taskOrSpec = Object.keys(modelOverrides).length > 0
      ? { id: "", title: "", description: input, models: modelOverrides }
      : input;
  }

  try {
    await runPipeline(taskOrSpec, { interactive });
    console.log("[PASS] Pipeline completed successfully");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Pipeline error:", msg);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Fatal error:", msg);
  process.exit(1);
});

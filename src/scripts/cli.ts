import { runPipeline } from "../pipeline.js";

const spec = process.argv[2]?.trim();

if (!spec) {
  console.error("Usage: asset <spec>");
  process.exit(1);
}

runPipeline(spec).catch((err: unknown) => {
  console.error("Pipeline error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

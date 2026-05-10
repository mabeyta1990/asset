import { mkdir } from "node:fs/promises";
import { getRepoId } from "../context-hash.js";

async function bootstrap(): Promise<void> {
  const repoId = await getRepoId();

  await mkdir(`.ai-memory/${repoId}/sessions`, { recursive: true });
  await mkdir(`.ai-memory/${repoId}/canonical`, { recursive: true });
  await mkdir(`.ai-memory/${repoId}/staging`, { recursive: true });

  console.log(`[bootstrap] repo-id: ${repoId}`);
  console.log(`[bootstrap] directories initialized under .ai-memory/${repoId}/`);
  console.log(`[bootstrap] ready.`);
}

bootstrap().catch((err: unknown) => {
  console.error("[bootstrap] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

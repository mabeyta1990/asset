import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CanonicalState } from "../types.js";

let canonicalDir = ".ai-memory/canonical";

export function configureCanonical(repoId: string): void {
  canonicalDir = `.ai-memory/${repoId}/canonical`;
}

function pointersFile(): string { return join(canonicalDir, "cache-pointers.json"); }
function hashFile(): string { return join(canonicalDir, "codebase-hash.txt"); }
function schemaFile(): string { return join(canonicalDir, "schema.sql"); }

async function readOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function readCanonicalState(): Promise<CanonicalState | null> {
  const raw = await readOrNull(pointersFile());
  if (raw === null) return null;
  return JSON.parse(raw) as CanonicalState;
}

export async function getCodebaseHash(): Promise<string | null> {
  const raw = await readOrNull(hashFile());
  return raw === null ? null : raw.trim();
}

export async function getSchema(): Promise<string | null> {
  return readOrNull(schemaFile());
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CanonicalState } from "../types.js";

const CANONICAL_DIR = ".ai-memory/canonical";
const POINTERS_FILE = join(CANONICAL_DIR, "cache-pointers.json");
const HASH_FILE = join(CANONICAL_DIR, "codebase-hash.txt");
const SCHEMA_FILE = join(CANONICAL_DIR, "schema.sql");

async function readOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function readCanonicalState(): Promise<CanonicalState | null> {
  const raw = await readOrNull(POINTERS_FILE);
  if (raw === null) return null;
  return JSON.parse(raw) as CanonicalState;
}

export async function getCodebaseHash(): Promise<string | null> {
  const raw = await readOrNull(HASH_FILE);
  return raw === null ? null : raw.trim();
}

export async function getSchema(): Promise<string | null> {
  return readOrNull(SCHEMA_FILE);
}

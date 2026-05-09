import { execFile } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import type { CanonicalState } from "../types.js";
import { readCanonicalState } from "./canonical.js";
import { deleteCacheByDisplayName } from "../wrappers/gemini.js";

const CANONICAL_DIR = ".ai-memory/canonical";
const POINTERS_FILE = join(CANONICAL_DIR, "cache-pointers.json");
const HASH_FILE = join(CANONICAL_DIR, "codebase-hash.txt");

const execFileAsync = promisify(execFile);

async function atomicWrite(filePath: string, data: string): Promise<void> {
  const dir = dirname(filePath);
  const tmp = join(dir, `.tmp-${randomBytes(6).toString("hex")}`);
  await writeFile(tmp, data, "utf8");
  await rename(tmp, filePath);
}

async function getCurrentCommitHash(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
  return stdout.trim();
}

export async function deleteStaleCaches(previousCacheName: string): Promise<number> {
  return deleteCacheByDisplayName(previousCacheName);
}

export async function refreshCanonicalState(
  sessionId: string,
  geminiCacheName: string,
): Promise<CanonicalState> {
  await mkdir(CANONICAL_DIR, { recursive: true });

  const existing = await readCanonicalState();
  const codebaseHash = await getCurrentCommitHash();
  const now = new Date().toISOString();

  const state: CanonicalState = {
    schemaVersion: existing?.schemaVersion ?? "1.0",
    codebaseHash,
    lastUpdated: now,
    cachePointers: {
      ...existing?.cachePointers,
      gemini: geminiCacheName,
      session: sessionId,
    },
  };

  await atomicWrite(HASH_FILE, `${codebaseHash}\n`);
  await atomicWrite(POINTERS_FILE, JSON.stringify(state, null, 2));

  return state;
}

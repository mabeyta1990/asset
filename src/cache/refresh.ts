import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import type { CanonicalState } from "../types.js";
import { readCanonicalState } from "./canonical.js";
import { deleteCacheByDisplayName } from "../wrappers/gemini.js";

let canonicalDir = ".ai-memory/canonical";
let stagingDir = ".ai-memory/staging";

export function configureRefresh(repoId: string): void {
  canonicalDir = `.ai-memory/${repoId}/canonical`;
  stagingDir = `.ai-memory/${repoId}/staging`;
}

export function getStagingDir(): string {
  return stagingDir;
}

const execFileAsync = promisify(execFile);

async function atomicWriteAll(files: Array<{ dest: string; data: string }>): Promise<void> {
  const temps: Array<{ tmp: string; dest: string }> = [];
  try {
    for (const { dest, data } of files) {
      const dir = dirname(dest);
      await mkdir(dir, { recursive: true });
      const tmp = join(dir, `.tmp-${randomBytes(6).toString("hex")}`);
      await writeFile(tmp, data, "utf8");
      temps.push({ tmp, dest });
    }
    for (const { tmp, dest } of temps) {
      await rename(tmp, dest);
    }
  } catch (err) {
    await Promise.all(temps.map(({ tmp }) => rm(tmp, { force: true })));
    throw err;
  }
}

async function getCurrentCommitHash(): Promise<string> {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
  return stdout.trim();
}

export async function deleteStaleCaches(previousCacheName: string): Promise<number> {
  return deleteCacheByDisplayName(previousCacheName);
}

export async function promoteStagedFiles(sessionId: string): Promise<void> {
  const sessionStagingDir = join(stagingDir, sessionId);
  const stagedCode = join(sessionStagingDir, "generated-code.ts");
  const stagedTests = join(sessionStagingDir, "generated-tests.test.ts");

  const [codeContent, testsContent] = await Promise.all([
    readFile(stagedCode, "utf8"),
    readFile(stagedTests, "utf8"),
  ]);

  if (!codeContent.trim()) throw new Error("Staged code file is empty — refusing to promote.");
  if (!testsContent.trim()) throw new Error("Staged tests file is empty — refusing to promote.");

  await atomicWriteAll([
    { dest: "src/generated-code.ts", data: codeContent },
    { dest: "src/generated-tests.test.ts", data: testsContent },
  ]);
}

export async function refreshCanonicalState(
  sessionId: string,
  geminiCacheName: string,
): Promise<CanonicalState> {
  await mkdir(canonicalDir, { recursive: true });

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

  const pointersFile = join(canonicalDir, "cache-pointers.json");
  const hashFile = join(canonicalDir, "codebase-hash.txt");

  await atomicWriteAll([
    { dest: hashFile, data: `${codebaseHash}\n` },
    { dest: pointersFile, data: JSON.stringify(state, null, 2) },
  ]);

  return state;
}

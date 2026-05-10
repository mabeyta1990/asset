import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CanonicalState } from "./types.js";

const REPO_ID_FILE = ".ai-memory/repo-id";
const CONTEXT_DIRS = ["docs"];
const SCHEMA_FILES = ["package.json", "tsconfig.json"];

interface ContextManifest {
  generatedAt: string;
  files: Record<string, string>;
}

export async function getRepoId(): Promise<string> {
  try {
    return (await readFile(REPO_ID_FILE, "utf8")).trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    await mkdir(".ai-memory", { recursive: true });
    const id = randomUUID();
    await writeFile(REPO_ID_FILE, id, "utf8");
    return id;
  }
}

export function computeHash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function manifestsMatch(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.join("\0") !== bKeys.join("\0")) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

async function collectFiles(dir: string): Promise<string[]> {
  const paths: string[] = [];
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return paths;
    throw err;
  }
  for (const name of names) {
    const full = join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      paths.push(...(await collectFiles(full)));
    } else {
      paths.push(full);
    }
  }
  return paths;
}

async function buildManifest(): Promise<ContextManifest> {
  const allFiles: string[] = [];

  for (const dir of CONTEXT_DIRS) {
    allFiles.push(...(await collectFiles(dir)));
  }

  for (const schema of SCHEMA_FILES) {
    try {
      await readFile(schema);
      allFiles.push(schema);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  allFiles.sort();

  const files: Record<string, string> = {};
  for (const filePath of allFiles) {
    const content = await readFile(filePath);
    files[filePath] = computeHash(content);
  }

  return { generatedAt: new Date().toISOString(), files };
}

function manifestFilePath(repoId: string): string {
  return join(`.ai-memory/${repoId}/canonical`, "context-manifest.json");
}

async function loadStoredManifest(repoId: string): Promise<ContextManifest | null> {
  try {
    const raw = await readFile(manifestFilePath(repoId), "utf8");
    return JSON.parse(raw) as ContextManifest;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function saveManifest(repoId: string, manifest: ContextManifest): Promise<void> {
  const path = manifestFilePath(repoId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2), "utf8");
}

export async function checkContextChange(
  repoId: string,
  readCanonical: () => Promise<CanonicalState | null>,
  deleteCache: (name: string) => Promise<number>,
): Promise<void> {
  const current = await buildManifest();
  const stored = await loadStoredManifest(repoId);

  if (stored === null) {
    await saveManifest(repoId, current);
    return;
  }

  if (manifestsMatch(current.files, stored.files)) return;

  try {
    const canonicalState = await readCanonical();
    const geminiName = canonicalState?.cachePointers?.["gemini"];
    if (geminiName) {
      await deleteCache(geminiName);
    }
    await saveManifest(repoId, current);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Fatal: context invalidation failed — ${msg}`);
  }
}

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { StageName, StageOutput, SessionState, StageVerdict, TaskStageKey } from "./types.js";

let sessionsRoot = ".ai-memory/sessions";

export function configureMemory(repoId: string): void {
  sessionsRoot = `.ai-memory/${repoId}/sessions`;
}

const STAGE_NAMES: Record<number, StageName> = {
  0: "research",
  1: "plan",
  2: "code",
  3: "tests",
  4: "audit-pre",
  5: "execution",
  6: "audit-post",
};

async function atomicWrite(filePath: string, data: string): Promise<void> {
  const dir = dirname(filePath);
  const tmp = join(dir, `.tmp-${randomBytes(6).toString("hex")}`);
  await writeFile(tmp, data, "utf8");
  await rename(tmp, filePath);
}

function stageFilename(stageIndex: number, stageName: StageName): string {
  return `${String(stageIndex).padStart(2, "0")}-${stageName}.json`;
}

function resolveStageFile(sessionId: string, stageIndex: number): string {
  const name = STAGE_NAMES[stageIndex];
  if (name === undefined) throw new Error(`Unknown stage index: ${stageIndex}`);
  return join(sessionsRoot, sessionId, stageFilename(stageIndex, name));
}

export async function initSession(spec: string, modelSelection?: Record<TaskStageKey, string>): Promise<string> {
  const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionDir = join(sessionsRoot, sessionId);
  await mkdir(sessionDir, { recursive: true });

  const state: SessionState = {
    sessionId,
    spec,
    startedAt: new Date().toISOString(),
    stages: {},
    ...(modelSelection && { modelSelection }),
  };

  await atomicWrite(join(sessionDir, "session.json"), JSON.stringify(state, null, 2));
  return sessionId;
}

export async function writeStage(
  sessionId: string,
  stageIndex: number,
  stageName: StageName,
  output: StageOutput,
): Promise<void> {
  const sessionDir = join(sessionsRoot, sessionId);
  await atomicWrite(
    join(sessionDir, stageFilename(stageIndex, stageName)),
    JSON.stringify(output, null, 2),
  );

  const sessionPath = join(sessionDir, "session.json");
  const raw = await readFile(sessionPath, "utf8");
  const state = JSON.parse(raw) as SessionState;
  state.stages[stageName] = output;
  await atomicWrite(sessionPath, JSON.stringify(state, null, 2));
}

export async function readStage(sessionId: string, stageIndex: number): Promise<StageOutput> {
  const filePath = resolveStageFile(sessionId, stageIndex);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as StageOutput;
}

export async function finalizeSession(
  sessionId: string,
  result: { verdict: StageVerdict; summary?: string },
): Promise<void> {
  const sessionDir = join(sessionsRoot, sessionId);
  const now = new Date().toISOString();

  await atomicWrite(
    join(sessionDir, "final.json"),
    JSON.stringify({ ...result, completedAt: now }, null, 2),
  );

  const sessionPath = join(sessionDir, "session.json");
  const raw = await readFile(sessionPath, "utf8");
  const state = JSON.parse(raw) as SessionState;
  state.completedAt = now;
  state.finalVerdict = result.verdict;
  await atomicWrite(sessionPath, JSON.stringify(state, null, 2));
}

export async function archiveSession(sessionId: string): Promise<void> {
  await writeFile(join(sessionsRoot, sessionId, "COMPLETE"), "", "utf8");
}

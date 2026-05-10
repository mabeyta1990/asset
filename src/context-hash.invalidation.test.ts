import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { checkContextChange } from "./context-hash.js";

const REPO_ID = "test-repo-invalidation";
const MANIFEST_PATH = `.ai-memory/${REPO_ID}/canonical/context-manifest.json`;

describe("checkContextChange — invalidation failure", () => {
  beforeEach(async () => {
    await mkdir(dirname(MANIFEST_PATH), { recursive: true });
    // Stored manifest references a file that does not exist, guaranteeing mismatch
    // with the manifest built from the real docs/ directory.
    const staleManifest = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      files: { "docs/__stale_marker_that_does_not_exist__.md": "aaabbbccc" },
    };
    await writeFile(MANIFEST_PATH, JSON.stringify(staleManifest), "utf8");
  });

  afterEach(async () => {
    await rm(`.ai-memory/${REPO_ID}`, { recursive: true, force: true });
  });

  it("rethrows deleteCache failure as Fatal error", async () => {
    const readCanonicalStub = async () => ({
      codebaseHash: "x",
      schemaVersion: "1.0",
      lastUpdated: new Date().toISOString(),
      cachePointers: { gemini: "projects/test/caches/abc" },
    });

    const deleteCacheStub = async (_name: string): Promise<number> => {
      throw new Error("delete failed");
    };

    await expect(
      checkContextChange(REPO_ID, readCanonicalStub, deleteCacheStub),
    ).rejects.toThrow(/^Fatal: context invalidation failed/);
  });
});

/**
 * Sandbox verification: writes to the macOS host outside the staging directory must be blocked.
 * Run this file through runTestsInVM (or the equivalent orb command) — NOT via local vitest.
 * Expected result: all writes to /mnt/mac paths outside staging throw EROFS.
 */
import { describe, it, expect } from "vitest";
import { writeFileSync, existsSync } from "fs";

const OUTSIDE_TARGETS = [
  "/mnt/mac/Users/mikea/Desktop/sandbox-escape.txt",
  "/mnt/mac/Users/mikea/Developer/asset/src/injected.ts",
  "/mnt/mac/tmp/sandbox-escape.txt",
];

describe("sandbox: host filesystem write isolation", () => {
  for (const target of OUTSIDE_TARGETS) {
    it(`write to ${target} is blocked`, () => {
      expect(() => writeFileSync(target, "escape")).toThrow();
      expect(existsSync(target)).toBe(false);
    });
  }

  it("write to /tmp inside VM is allowed (tmpfs)", () => {
    const vmLocal = `/tmp/sandbox-write-test-${Date.now()}.txt`;
    expect(() => writeFileSync(vmLocal, "ok")).not.toThrow();
  });
});

/**
 * Sandbox verification: outbound network access must be blocked.
 * Run this file through runTestsInVM (or the equivalent orb command) — NOT via local vitest.
 * Expected result: all network attempts throw / reject.
 */
import { describe, it, expect } from "vitest";
import { createConnection } from "net";
import { get as httpGet } from "http";

describe("sandbox: network isolation", () => {
  it("TCP connect to 1.1.1.1:80 is refused or times out", () =>
    new Promise<void>((resolve, reject) => {
      const sock = createConnection({ host: "1.1.1.1", port: 80, timeout: 3000 });
      sock.on("error", () => { sock.destroy(); resolve(); });
      sock.on("timeout", () => { sock.destroy(); resolve(); });
      sock.on("connect", () => { sock.destroy(); reject(new Error("TCP connect succeeded — network not isolated")); });
    }));

  it("HTTP GET to example.com fails", () =>
    new Promise<void>((resolve, reject) => {
      const req = httpGet({ host: "example.com", port: 80, path: "/", timeout: 3000 }, () => {
        reject(new Error("HTTP response received — network not isolated"));
      });
      req.on("error", () => resolve());
      req.on("timeout", () => { req.destroy(); resolve(); });
    }));
});

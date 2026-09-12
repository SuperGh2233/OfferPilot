import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((done) => server.close(() => done())),
    ),
  );
});

describe("production smoke script", () => {
  it("checks protected pages and every unauthenticated JSON API", async () => {
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      if (request.url === "/login") {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end("登录训练系统");
        return;
      }
      if (request.url?.startsWith("/api/")) {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end('{"error":"unauthorized"}');
        return;
      }
      response.writeHead(307, { Location: "/login" });
      response.end();
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        resolve(process.cwd(), "scripts/smoke.mjs"),
        `http://127.0.0.1:${address.port}`,
      ],
      { timeout: 5_000 },
    );

    expect(stdout).toContain("Smoke test passed.");
    expect(requests).toEqual([
      "GET /login",
      "GET /dashboard",
      "POST /api/ai/analyze-code",
      "GET /api/training/snapshot",
      "POST /api/training/algorithm",
      "POST /api/training/knowledge",
      "PUT /api/training/profile",
      "GET /__offerpilot_smoke_missing__",
    ]);
  });
});

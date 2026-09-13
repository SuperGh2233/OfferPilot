import { describe, expect, it } from "vitest";

import { createResilientFetch } from "../lib/supabase/resilient-fetch";

function jsonResponse(status: number, body = "{}") {
  return new Response(body, { status, headers: { "Content-Type": "application/json" } });
}

describe("createResilientFetch", () => {
  it("retries a gateway timeout and returns the eventual success", async () => {
    const calls: RequestInit[] = [];
    const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      return Promise.resolve(calls.length === 1 ? jsonResponse(504) : jsonResponse(200, "ok"));
    }) as typeof fetch;

    const resilient = createResilientFetch(fetchImpl, { retryDelaysMs: [0, 0] });
    const response = await resilient("https://example.supabase.co/rest/v1/profiles");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(calls).toHaveLength(2);
  });

  it("returns the final gateway response instead of throwing when retries are exhausted", async () => {
    const fetchImpl = (() => Promise.resolve(jsonResponse(503))) as typeof fetch;
    const resilient = createResilientFetch(fetchImpl, { retryDelaysMs: [0, 0] });

    const response = await resilient("https://example.supabase.co/rest/v1/profiles");

    expect(response.status).toBe(503);
  });

  it("does not retry authentication or validation errors", async () => {
    let calls = 0;
    const fetchImpl = ((() => {
      calls += 1;
      return Promise.resolve(jsonResponse(401));
    }) ) as typeof fetch;
    const resilient = createResilientFetch(fetchImpl, { retryDelaysMs: [0, 0] });

    const response = await resilient("https://example.supabase.co/auth/v1/user");

    expect(response.status).toBe(401);
    expect(calls).toBe(1);
  });

  it("retries network failures and rethrows the last error", async () => {
    let calls = 0;
    const fetchImpl = ((() => {
      calls += 1;
      return Promise.reject(new TypeError("fetch failed"));
    })) as typeof fetch;
    const resilient = createResilientFetch(fetchImpl, { retryDelaysMs: [0, 0] });

    await expect(
      resilient("https://example.supabase.co/rest/v1/profiles"),
    ).rejects.toThrow("fetch failed");
    expect(calls).toBe(3);
  });

  it("aborts slow attempts via the injected timeout signal and retries", async () => {
    let calls = 0;
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal!.reason ?? new Error("aborted"));
        });
      });
    }) as typeof fetch;
    const resilient = createResilientFetch(fetchImpl, {
      timeoutMs: 20,
      retryDelaysMs: [0, 0],
    });

    await expect(
      resilient("https://example.supabase.co/rest/v1/profiles"),
    ).rejects.toThrow();
    expect(calls).toBe(3);
  });

  it("performs a single attempt when the request body cannot be replayed", async () => {
    let calls = 0;
    const fetchImpl = ((() => {
      calls += 1;
      return Promise.resolve(jsonResponse(504));
    })) as typeof fetch;
    const resilient = createResilientFetch(fetchImpl, { retryDelaysMs: [0, 0] });
    const streamBody = new ReadableStream<Uint8Array>();

    const response = await resilient("https://example.supabase.co/rest/v1/rpc/x", {
      method: "POST",
      body: streamBody as unknown as BodyInit,
    });

    expect(response.status).toBe(504);
    expect(calls).toBe(1);
  });

  it("forwards the caller's signal alongside the timeout signal", async () => {
    let observed: AbortSignal | null | undefined;
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => {
      observed = init?.signal;
      return Promise.resolve(jsonResponse(200));
    }) as typeof fetch;
    const resilient = createResilientFetch(fetchImpl);
    const controller = new AbortController();

    await resilient("https://example.supabase.co/rest/v1/profiles", {
      signal: controller.signal,
    });

    expect(observed).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect(observed?.aborted).toBe(true);
  });
});

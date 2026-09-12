import { afterEach, describe, expect, it, vi } from "vitest";

import { isLocalDemoMode } from "../lib/supabase/env";

describe("local demo mode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("only bypasses auth in development", () => {
    vi.stubEnv("LOCAL_DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(isLocalDemoMode()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalDemoMode()).toBe(false);
  });
});

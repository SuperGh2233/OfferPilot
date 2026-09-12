const argument = process.argv.find((value) => value.startsWith("--base-url="));
const positionalUrl = process.argv.slice(2).find((value) => /^https?:\/\//.test(value));
const baseUrl = (
  argument?.slice("--base-url=".length) ??
  positionalUrl ??
  process.env.SMOKE_BASE_URL
)?.replace(/\/$/, "");
const demoMode = process.argv.includes("--demo") || process.argv.includes("demo");

if (!baseUrl) {
  throw new Error("Pass the site URL or set SMOKE_BASE_URL");
}

async function request(path, init) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    redirect: "manual",
    signal: init?.signal ?? AbortSignal.timeout(15_000),
  });
}

const login = await request("/login");
if (login.status !== 200 || !(await login.text()).includes("登录训练系统")) {
  throw new Error(`/login expected the login page, received ${login.status}`);
}
console.log("/login: 200");

const dashboard = await request("/dashboard");
if (demoMode) {
  if (dashboard.status !== 200) {
    throw new Error(`/dashboard expected 200 in demo mode, received ${dashboard.status}`);
  }
  console.log("/dashboard: 200 (demo)");
} else {
  const location = dashboard.headers.get("location");
  if (![307, 308].includes(dashboard.status) || !location?.endsWith("/login")) {
    throw new Error(
      `/dashboard expected an unauthenticated redirect to /login, received ${dashboard.status} ${location ?? ""}`,
    );
  }
  console.log(`/dashboard: ${dashboard.status} -> /login`);

  const protectedApis = [
    ["/api/ai/analyze-code", "POST"],
    ["/api/training/snapshot", "GET"],
    ["/api/training/algorithm", "POST"],
    ["/api/training/knowledge", "POST"],
    ["/api/training/profile", "PUT"],
  ];

  for (const [path, method] of protectedApis) {
    const api = await request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : "{}",
    });
    if (
      api.status !== 401 ||
      api.headers.get("content-type")?.includes("application/json") !== true
    ) {
      throw new Error(`${path} expected JSON 401, received ${api.status}`);
    }
    console.log(`${path}: 401 JSON (unauthenticated)`);
  }
}

const missing = await request("/__offerpilot_smoke_missing__");
if (demoMode) {
  if (missing.status !== 404) {
    throw new Error(`/__offerpilot_smoke_missing__ expected 404, received ${missing.status}`);
  }
  console.log("custom not-found: 404 (demo)");
} else {
  const location = missing.headers.get("location");
  if (![307, 308].includes(missing.status) || !location?.endsWith("/login")) {
    throw new Error(
      `/__offerpilot_smoke_missing__ expected the unauthenticated /login boundary, received ${missing.status} ${location ?? ""}`,
    );
  }
  console.log(`unknown protected page: ${missing.status} -> /login`);
}
console.log("Smoke test passed.");

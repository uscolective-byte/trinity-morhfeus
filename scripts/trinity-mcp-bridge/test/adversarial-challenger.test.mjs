import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp, auditCommand, runSafeCommand, BRIDGE_TOKEN, WORKSPACE_DIR } from "../server.mjs";

const DEFAULT_LIVE_URL = "http://127.0.0.1:3333";
const VALID_TOKEN = "trinity-local-secret";

let testServer = null;
let activeUrl = DEFAULT_LIVE_URL;

test.before(async () => {
  try {
    const probe = await fetch(`${DEFAULT_LIVE_URL}/health`, { signal: AbortSignal.timeout(500) });
    if (probe.ok) {
      const authProbe = await fetch(`${DEFAULT_LIVE_URL}/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-trinity-token": VALID_TOKEN },
        body: JSON.stringify({ command: "node -v" }),
        signal: AbortSignal.timeout(500)
      });
      if (authProbe.status !== 401) {
        return;
      }
    }
  } catch {}

  process.env.TRINITY_TOKEN = VALID_TOKEN;
  const app = createApp();
  testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, "127.0.0.1", resolve));
  const port = testServer.address().port;
  activeUrl = `http://127.0.0.1:${port}`;
});

test.after(() => {
  if (testServer) testServer.close();
});

// ============================================================================
// PART 1: LIVE DAEMON EMPIRICAL VERIFICATION
// ============================================================================

test("Live Daemon Check 1: Missing token on POST /exec (must return 401)", async () => {
  const res = await fetch(`${activeUrl}/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: "git status --short" })
  });
  const body = await res.json();
  console.log("Live Check 1 Receipt:", { status: res.status, body });
  assert.equal(res.status, 401);
  assert.deepEqual(body, { error: "Neplatný TRINITY token" });
});

test("Live Daemon Check 2: Wrong token on POST /exec (must return 401)", async () => {
  const invalidTokens = ["wrong-token", "", "invalid_secret", "Bearer trinity-local-secret"];
  for (const token of invalidTokens) {
    const res = await fetch(`${activeUrl}/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trinity-token": token
      },
      body: JSON.stringify({ command: "git status --short" })
    });
    const body = await res.json();
    console.log(`Live Check 2 Receipt (token='${token}'):`, { status: res.status, body });
    assert.equal(res.status, 401);
    assert.deepEqual(body, { error: "Neplatný TRINITY token" });
  }
});

test("Live Daemon Check 3: Sandbox traversal attempts (must return 400 SANDBOX VIOLATION)", async () => {
  const maliciousSubdirs = [
    "../../../Windows",
    "../../",
    "..\\..\\..\\Windows",
    "C:\\Windows",
    "C:\\Windows\\System32",
    "..\\Trinity-antigravity-backup",
    "C:\\Users\\saboi\\Trinity-antigravity-fake"
  ];
  for (const subdir of maliciousSubdirs) {
    const res = await fetch(`${activeUrl}/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trinity-token": VALID_TOKEN
      },
      body: JSON.stringify({ command: "dir", subdir })
    });
    const body = await res.json();
    console.log(`Live Check 3 Receipt (subdir='${subdir}'):`, { status: res.status, body });
    assert.equal(res.status, 400);
    assert.equal(body.status, "error");
    assert.match(body.message, /SANDBOX VIOLATION/);
  }
});

test("Live Daemon Check 4: Destructive command audit (must return 400 SECURITY AUDIT REJECTED)", async () => {
  const mandatedCommands = [
    "rm -rf /",
    "format c:",
    "mkfs",
    "del /s /q c:\\",
    "del /q /s c:\\",
    "del /f /q /s c:\\",
    "rmdir /s /q c:\\",
    "rd /s /q c:\\",
    "rm -rf /etc"
  ];
  for (const cmd of mandatedCommands) {
    const res = await fetch(`${activeUrl}/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-trinity-token": VALID_TOKEN
      },
      body: JSON.stringify({ command: cmd })
    });
    const body = await res.json();
    console.log(`Live Check 4 Receipt (cmd='${cmd}'):`, { status: res.status, body });
    assert.equal(res.status, 400);
    assert.equal(body.status, "error");
    assert.match(body.message, /SECURITY AUDIT REJECTED/);
  }
});

test("Live Daemon Check 5: Disallowed CORS origin (must return 403 Forbidden)", async () => {
  const res = await fetch(`${activeUrl}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://malicious-site.com",
      "x-trinity-token": VALID_TOKEN
    },
    body: JSON.stringify({ command: "git status --short" })
  });
  const body = await res.json();
  const corsHeader = res.headers.get("access-control-allow-origin");
  console.log("Live Check 5 Receipt (Disallowed Origin https://malicious-site.com):", {
    status: res.status,
    corsHeader,
    body
  });

  assert.equal(res.status, 403, "Disallowed origin must return HTTP 403 Forbidden");
  assert.equal(corsHeader, null, "Access-Control-Allow-Origin header must not be wildcard or set for disallowed origin");
  assert.match(body.error, /CORS_REJECTED/, "Response error message must indicate CORS rejection");
});

test("Live Daemon Check 6: Allowed CORS origin (https://gemini.google.com)", async () => {
  const res = await fetch(`${activeUrl}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://gemini.google.com",
      "x-trinity-token": VALID_TOKEN
    },
    body: JSON.stringify({ command: "node -e \"console.log('cors-check')\"" })
  });
  const body = await res.json();
  console.log("Live Check 6 Receipt:", { status: res.status, body });
  assert.equal(res.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.result.exitCode, 0);
});

test("Live Daemon Check 7: Valid command execution (POST /exec with git status --short)", async () => {
  const res = await fetch(`${activeUrl}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://gemini.google.com",
      "x-trinity-token": VALID_TOKEN
    },
    body: JSON.stringify({ command: "git status --short" })
  });
  const body = await res.json();
  console.log("Live Check 7 Receipt:", { status: res.status, exitCode: body?.result?.exitCode });
  assert.equal(res.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.result.exitCode, 0);
});

test("Live Daemon Check 8: Stability under rapid adversarial burst", async () => {
  const health1 = await (await fetch(`${activeUrl}/health`)).json();
  assert.equal(health1.status, "ok");

  // Fire 10 concurrent requests
  const reqs = [];
  for (let i = 0; i < 10; i++) {
    reqs.push(fetch(`${activeUrl}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-trinity-token": "bad" },
      body: JSON.stringify({ command: "git status" })
    }));
  }
  const responses = await Promise.all(reqs);
  assert.equal(responses.every(r => r.status === 401), true);

  const health2 = await (await fetch(`${activeUrl}/health`)).json();
  console.log("Live Check 8 Health After Burst:", health2);
  assert.equal(health2.status, "ok");
});

// ============================================================================
// PART 2: HARDENED ADVERSARIAL AUDIT (Regex Bypasses & Traversal Defenses)
// ============================================================================

test("Hardened Audit 1: Broad rm -rf commands are blocked by BLOCKED_PATTERNS", () => {
  assert.throws(() => auditCommand("rm -rf /"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rm -rf /etc"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rm -rf /usr/local"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rm -rf C:\\Windows"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rm -rf ~"), /SECURITY AUDIT REJECTED/);
});

test("Hardened Audit 2: Flag inversions, rmdir, and rd are blocked by Windows patterns", () => {
  assert.throws(() => auditCommand("del /s /q c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("del /q /s c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("del /f /q /s c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("del /q /f /s C:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rmdir /s /q c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rmdir /q /s c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rd /s /q c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rd /q /s c:\\"), /SECURITY AUDIT REJECTED/);
});

// ============================================================================
// PART 3: COMMITTED CODE IN-MEMORY VERIFICATION (createApp())
// ============================================================================

test("Committed Code Check: Verifying createApp() CORS rejection on fresh instance", async (t) => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  t.after(() => server.close());

  // Test malicious origin on fresh app instance
  const res = await fetch(`http://127.0.0.1:${port}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://malicious-site.com",
      "x-trinity-token": VALID_TOKEN
    },
    body: JSON.stringify({ command: "git status --short" })
  });
  const body = await res.json();
  console.log("Committed Code Fresh App Origin Rejection Receipt:", { status: res.status, body });
  assert.equal(res.status, 403);
  assert.match(body.error, /CORS_REJECTED/);
});

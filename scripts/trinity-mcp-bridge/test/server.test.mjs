import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import {
  createApp,
  isOriginAllowed,
  auditCommand,
  runSafeCommand,
  BLOCKED_PATTERNS,
  BRIDGE_TOKEN,
  WORKSPACE_DIR
} from "../server.mjs";

test("Trinity Bridge: Origin Whitelist Verification", () => {
  // Allowed LLM & Trinity origins
  assert.equal(isOriginAllowed("https://gemini.google.com"), true);
  assert.equal(isOriginAllowed("https://chatgpt.com"), true);
  assert.equal(isOriginAllowed("https://chat.openai.com"), true);
  assert.equal(isOriginAllowed("https://claude.ai"), true);
  assert.equal(isOriginAllowed("https://auru.space"), true);
  assert.equal(isOriginAllowed("https://www.auru.space"), true);
  assert.equal(isOriginAllowed("https://auru.dev"), true);
  assert.equal(isOriginAllowed("http://localhost:3000"), true);
  assert.equal(isOriginAllowed("http://127.0.0.1:8791"), true);
  assert.equal(isOriginAllowed("null"), true);
  assert.equal(isOriginAllowed(undefined), true);

  // Untrusted / Attack origins
  assert.equal(isOriginAllowed("https://evil-hacker.com"), false);
  assert.equal(isOriginAllowed("https://phishing.site"), false);
  assert.equal(isOriginAllowed("https://fake-gemini.google.com.attacker.com"), false);
});

test("Trinity Bridge: Destructive Command Audit", () => {
  assert.throws(() => auditCommand("rm -rf /"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("format c:"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("mkfs.ext4 /dev/sda1"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("dd if=/dev/zero of=/dev/sda"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("del /s /q c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("Remove-Item -Recurse -Force C:\\"), /SECURITY AUDIT REJECTED/);

  // Hardened adversarial variants
  assert.throws(() => auditCommand("del /q /s c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("del /f /q /s c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rmdir /s /q c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rd /s /q c:\\"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("rm -rf /etc"), /SECURITY AUDIT REJECTED/);
  assert.throws(() => auditCommand("Remove-Item -Force -Recurse C:\\"), /SECURITY AUDIT REJECTED/);

  // Safe commands should not throw
  assert.doesNotThrow(() => auditCommand("git status"));
  assert.doesNotThrow(() => auditCommand("node -v"));
  assert.doesNotThrow(() => auditCommand("npm test"));
  assert.doesNotThrow(() => auditCommand("dir"));
  assert.doesNotThrow(() => auditCommand("echo hello"));
});

test("Trinity Bridge: Workspace Boundary & Path Traversal Guard", async () => {
  // Attempting to break out of WORKSPACE_DIR must fail
  await assert.rejects(
    () => runSafeCommand("dir", "../../.."),
    /SANDBOX VIOLATION/
  );
  await assert.rejects(
    () => runSafeCommand("dir", "C:\\Windows\\System32"),
    /SANDBOX VIOLATION/
  );
  await assert.rejects(
    () => runSafeCommand("dir", "../Trinity-antigravity-backup"),
    /SANDBOX VIOLATION/
  );
  await assert.rejects(
    () => runSafeCommand("dir", "../Trinity-antigravity-secret"),
    /SANDBOX VIOLATION/
  );
});

test("Trinity Bridge HTTP API: Auth, CORS & Execution End-to-End", async (t) => {
  const app = createApp();
  const testServer = http.createServer(app);
  
  await new Promise((resolve) => testServer.listen(0, "127.0.0.1", resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    testServer.close();
  });

  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/health`);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.status, "ok");
  assert.equal(healthData.service, "trinity-mcp-bridge");

  // 2. Unauthenticated /exec call -> 401
  const unauthRes = await fetch(`${baseUrl}/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: "echo test" })
  });
  assert.equal(unauthRes.status, 401);

  // 3. Invalid token -> 401
  const badTokenRes = await fetch(`${baseUrl}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-trinity-token": "wrong-secret-token"
    },
    body: JSON.stringify({ command: "echo test" })
  });
  assert.equal(badTokenRes.status, 401);

  // 4. Forbidden CORS Origin -> 403
  const badCorsRes = await fetch(`${baseUrl}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://malicious-website.com",
      "x-trinity-token": BRIDGE_TOKEN
    },
    body: JSON.stringify({ command: "echo test" })
  });
  assert.equal(badCorsRes.status, 403);

  // 5. Allowed Origin + Valid Token + Safe execution -> 200
  const validRes = await fetch(`${baseUrl}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://gemini.google.com",
      "x-trinity-token": BRIDGE_TOKEN
    },
    body: JSON.stringify({ command: "node -e \"console.log('trinity-mcp-ok')\"" })
  });
  assert.equal(validRes.status, 200);
  const validData = await validRes.json();
  assert.equal(validData.status, "ok");
  assert.equal(validData.result.exitCode, 0);
  assert.match(validData.result.stdout, /trinity-mcp-ok/);
});

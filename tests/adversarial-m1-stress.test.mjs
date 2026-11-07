import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accessHeaders, resolveEnvCredentials, validateOrigin } from '../scripts/lib/cloudflare-access.mjs';

const TARGET_ORIGINS = ['https://auru.space', 'https://auru.dev'];
const EXPECTED_TOOL_COUNT = 42;

// Load real credentials safely for live empirical tests
const env = resolveEnvCredentials(process.env);
const cfHeaders = accessHeaders(env);
const mcpToken = env.TRINITY_MCP_API_KEY || env.TRINITY_MCP_TOKEN;
const hasCfServiceToken = Boolean(cfHeaders['CF-Access-Client-Id'] && cfHeaders['CF-Access-Client-Secret']);
const hasLiveMcpCredentials = Boolean(hasCfServiceToken && mcpToken);

// Helper to execute raw HTTP requests with manual redirect handling
async function rawFetch(url, options = {}) {
  const timeoutMs = options.timeoutMs || 25000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      redirect: options.redirect || 'manual',
      signal: controller.signal
    });
    const status = res.status;
    const location = res.headers.get('location') || '';
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    let json = null;
    try {
      const dataLines = text.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean);
      json = dataLines.length ? JSON.parse(dataLines.at(-1)) : JSON.parse(text);
    } catch {
      // Non-JSON response body
    }
    return { status, location, contentType, text, json, headers: res.headers };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// SUITE 1: CLOUDFLARE ACCESS EDGE BEHAVIOR & PERIMETER ADVERSARIAL STRESS TESTS
// ============================================================================
test('Edge Security: Unauthenticated requests are halted with HTTP 302 Cloudflare Access login redirect or HTTP 403 edge block', async (t) => {
  for (const origin of TARGET_ORIGINS) {
    await t.test(`${origin} unauthenticated /health returns HTTP 302 to cloudflareaccess.com or HTTP 403`, async () => {
      const res = await rawFetch(`${origin}/health`);
      assert.ok(res.status === 302 || res.status === 403, `Expected HTTP 302 or 403 on unauthenticated ${origin}/health, got ${res.status}`);
      if (res.status === 302) {
        assert.ok(res.location.includes('.cloudflareaccess.com'), `Expected location to point to cloudflareaccess.com, got: ${res.location}`);
      }
    });

    await t.test(`${origin} unauthenticated /ready returns HTTP 302 to cloudflareaccess.com or HTTP 403`, async () => {
      const res = await rawFetch(`${origin}/ready`);
      assert.ok(res.status === 302 || res.status === 403, `Expected HTTP 302 or 403 on unauthenticated ${origin}/ready, got ${res.status}`);
      if (res.status === 302) {
        assert.ok(res.location.includes('.cloudflareaccess.com'), `Expected location to point to cloudflareaccess.com, got: ${res.location}`);
      }
    });

    await t.test(`${origin} unauthenticated POST /mcp is halted at edge with HTTP 302 or 403`, async () => {
      const res = await rawFetch(`${origin}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { capabilities: {} } })
      });
      assert.ok(res.status === 302 || res.status === 403, `Expected unauthenticated POST /mcp to be blocked by edge 302 or 403, got ${res.status}`);
      if (res.status === 302) {
        assert.ok(res.location.includes('.cloudflareaccess.com'), `Expected location to point to cloudflareaccess.com, got: ${res.location}`);
      }
    });
  }
});

test('Edge Security: Invalid and partial Service Token credentials fail closed', async (t) => {
  for (const origin of TARGET_ORIGINS) {
    await t.test(`${origin} with bogus Service Token fails (HTTP 302 or 403)`, async () => {
      const res = await rawFetch(`${origin}/health`, {
        headers: {
          'CF-Access-Client-Id': 'bogus-client-id-12345678.access',
          'CF-Access-Client-Secret': 'bogus-secret-abcdef1234567890abcdef1234567890'
        }
      });
      // Cloudflare Access should reject invalid service tokens with 302 login redirect or 403 Forbidden
      assert.ok(
        res.status === 302 || res.status === 403,
        `Expected HTTP 302 or 403 for bogus credentials on ${origin}, got ${res.status}`
      );
      if (res.status === 302) {
        assert.ok(res.location.includes('.cloudflareaccess.com'));
      }
    });

    await t.test(`${origin} with missing Secret (only Client ID) fails closed`, async () => {
      const res = await rawFetch(`${origin}/health`, {
        headers: {
          'CF-Access-Client-Id': cfHeaders['CF-Access-Client-Id'] || 'some-id'
        }
      });
      assert.ok(
        res.status === 302 || res.status === 403,
        `Expected HTTP 302 or 403 for partial credentials on ${origin}, got ${res.status}`
      );
    });

    await t.test(`${origin} with missing Client ID (only Secret) fails closed`, async () => {
      const res = await rawFetch(`${origin}/health`, {
        headers: {
          'CF-Access-Client-Secret': cfHeaders['CF-Access-Client-Secret'] || 'some-secret'
        }
      });
      assert.ok(
        res.status === 302 || res.status === 403,
        `Expected HTTP 302 or 403 for partial credentials on ${origin}, got ${res.status}`
      );
    });
  }
});

test('Edge Security: Valid Service Token bypasses edge 302 redirects with HTTP 200', async (t) => {
  if (!hasCfServiceToken) {
    t.skip('Skipping live authenticated edge probe: CF-Access-Client-Id / CF-Access-Client-Secret not configured in environment');
    return;
  }

  for (const origin of TARGET_ORIGINS) {
    await t.test(`${origin}/health passes edge with valid Service Token`, async () => {
      const res = await rawFetch(`${origin}/health`, {
        headers: { ...cfHeaders, Accept: 'application/json' }
      });
      assert.equal(res.status, 200, `Expected HTTP 200 on authenticated ${origin}/health, got ${res.status}`);
      assert.equal(res.location, '', 'Authenticated request must not receive Location redirect');
      assert.ok(res.json, 'Response must be valid JSON');
      assert.ok(res.json.status === 'serving' || res.json.ok === true || Boolean(res.json.version));
    });

    await t.test(`${origin}/ready passes edge with valid Service Token`, async () => {
      const res = await rawFetch(`${origin}/ready`, {
        headers: { ...cfHeaders, Accept: 'application/json' }
      });
      assert.equal(res.status, 200, `Expected HTTP 200 on authenticated ${origin}/ready, got ${res.status}`);
      assert.equal(res.location, '', 'Authenticated request must not receive Location redirect');
      assert.ok(res.json, 'Response must be valid JSON');
      assert.equal(res.json.ready, true);
    });
  }
});

test('Edge vs Worker Separation: Valid Service Token reaches Worker runtime even without Bearer token', async (t) => {
  if (!hasCfServiceToken) {
    t.skip('Skipping live authenticated edge probe: CF-Access-Client-Id / CF-Access-Client-Secret not configured in environment');
    return;
  }
  for (const origin of TARGET_ORIGINS) {
    // When CF Service Token is valid, the request passes through the Cloudflare Access edge.
    // However, without Trinity Bearer token, Worker auth layer intercepts it (HTTP 401 or HTTP 403), NOT edge HTTP 302!
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        ...cfHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { capabilities: {} } })
    });

    assert.notEqual(
      res.status,
      302,
      `Service Token should bypass edge 302 redirect. Got HTTP 302 on ${origin}/mcp without Bearer token.`
    );
    assert.ok(
      [401, 403, 400, 200].includes(res.status),
      `Expected Worker response (401, 403, or auth error), got ${res.status}`
    );
  }
});

// ============================================================================
// SUITE 2: MCP PROTOCOL STRESS-TESTING & CRASH RESILIENCE ON POST /mcp
// ============================================================================
test('MCP Stress: Malformed JSON and corrupt payloads do not crash worker runtime', async (t) => {
  if (!hasLiveMcpCredentials) {
    t.skip('Skipping live authenticated MCP probe: CF Access + TRINITY_MCP_API_KEY not configured in environment');
    return;
  }
  const origin = 'https://auru.space';
  const authenticatedHeaders = {
    ...cfHeaders,
    Authorization: `Bearer ${mcpToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };

  await t.test('Malformed JSON syntax returns error or 400 without crashing (no 500/502)', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: '{"jsonrpc": "2.0", "id": 1, "method": ' // deliberately incomplete
    });
    // Server must reject cleanly: HTTP 400 or JSON-RPC 2.0 parse error (-32700)
    assert.ok(
      res.status === 400 || (res.status === 200 && res.json?.error?.code === -32700),
      `Expected HTTP 400 or JSON-RPC -32700 for malformed JSON, got status ${res.status}: ${res.text.slice(0, 100)}`
    );
    assert.notEqual(res.status, 500, 'Server must not throw unhandled 500 on malformed JSON');
    assert.notEqual(res.status, 502, 'Cloudflare must not report Bad Gateway 502');
  });

  await t.test('Empty request body does not crash server', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: ''
    });
    assert.ok(
      res.status === 400 || res.status === 405 || (res.status === 200 && res.json?.error),
      `Expected graceful error for empty body, got status ${res.status}`
    );
    assert.notEqual(res.status, 500);
    assert.notEqual(res.status, 502);
  });

  await t.test('Oversized payload (100KB gibberish) is handled gracefully without crash', async () => {
    const oversized = JSON.stringify({
      jsonrpc: '2.0',
      id: 999,
      method: 'tools/call',
      params: { name: 'diagnostic_ping', arguments: { message: 'x'.repeat(100_000) } }
    });
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: oversized
    });
    // Depending on rate limit or max body size, server may return 413, 400, or 200 with result/error
    assert.ok(
      [200, 400, 413, 429].includes(res.status),
      `Expected handled response for oversized body, got ${res.status}`
    );
    assert.notEqual(res.status, 500);
    assert.notEqual(res.status, 502);
  });
});

test('MCP Stress: Invalid JSON-RPC structural edge cases', async (t) => {
  if (!hasLiveMcpCredentials) {
    t.skip('Skipping live authenticated MCP probe: CF Access + TRINITY_MCP_API_KEY not configured in environment');
    return;
  }
  const origin = 'https://auru.space';
  const authenticatedHeaders = {
    ...cfHeaders,
    Authorization: `Bearer ${mcpToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };

  await t.test('Missing method field returns JSON-RPC invalid request (-32600) or HTTP 400', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 101 }) // missing method
    });
    assert.ok(
      res.status === 400 || (res.status === 200 && res.json?.error),
      `Expected invalid request rejection, got status ${res.status}`
    );
    if (res.json?.error) {
      assert.ok(
        [-32600, -32601, -32602].includes(res.json.error.code) || typeof res.json.error.message === 'string',
        `Expected standard error code, got ${JSON.stringify(res.json.error)}`
      );
    }
  });

  await t.test('Non-string method field (method: 12345) returns error without crash', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 102, method: 12345 })
    });
    assert.ok(res.status === 400 || (res.status === 200 && res.json?.error));
    assert.notEqual(res.status, 500);
  });

  await t.test('Non-existent method returns Method Not Found (-32601)', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 103, method: 'trinity_non_existent_method_xyz' })
    });
    assert.equal(res.status, 200, `Expected HTTP 200 JSON-RPC error response, got ${res.status}`);
    assert.ok(res.json?.error, 'Response must contain JSON-RPC error');
    assert.equal(res.json.error.code, -32601, `Expected error code -32601 (Method not found), got ${res.json.error.code}`);
  });
});

test('MCP Stress: Malformed tool calls and argument fuzzing', async (t) => {
  if (!hasLiveMcpCredentials) {
    t.skip('Skipping live authenticated MCP probe: CF Access + TRINITY_MCP_API_KEY not configured in environment');
    return;
  }
  const origin = 'https://auru.space';
  const authenticatedHeaders = {
    ...cfHeaders,
    Authorization: `Bearer ${mcpToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };

  await t.test('tools/call with non-existent tool name returns error cleanly', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 201,
        method: 'tools/call',
        params: { name: 'fictional_unregistered_tool', arguments: {} }
      })
    });
    assert.equal(res.status, 200);
    // Should return error in result or JSON-RPC error
    const hasError = Boolean(res.json?.error || res.json?.result?.isError || res.json?.result?.error);
    assert.ok(hasError, `Expected error for non-existent tool call, got: ${res.text}`);
  });

  await t.test('tools/call with non-object params returns error cleanly', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 202,
        method: 'tools/call',
        params: 'malformed_string_params'
      })
    });
    assert.ok(res.status === 400 || (res.status === 200 && (res.json?.error || res.json?.result?.isError)));
    assert.notEqual(res.status, 500);
  });

  await t.test('tools/call with non-object arguments returns error cleanly', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 203,
        method: 'tools/call',
        params: { name: 'diagnostic_ping', arguments: 'not_an_object' }
      })
    });
    assert.ok(res.status === 400 || (res.status === 200 && (res.json?.error || res.json?.result)));
    assert.notEqual(res.status, 500);
  });

  await t.test('Adversarial inputs: SQL injection, path traversal, null bytes in tool arguments do not crash', async (t) => {
    const attackStrings = [
      "' OR '1'='1' --",
      "'; DROP TABLE tasks; --",
      "../../../../../../windows/system32/cmd.exe",
      "\\..\\..\\..\\etc\\passwd",
      "\u0000\u0001\u001f\uffff",
      "<script>alert('xss')</script>"
    ];

    for (const attack of attackStrings) {
      const res = await rawFetch(`${origin}/mcp`, {
        method: 'POST',
        headers: authenticatedHeaders,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 204,
          method: 'tools/call',
          params: {
            name: 'diagnostic_ping',
            arguments: { message: attack, idempotency_key: '00000000-0000-0000-0000-000000000000' }
          }
        })
      });
      assert.ok(
        res.status === 200 || res.status === 400,
        `Server must handle attack string safely, got HTTP ${res.status}`
      );
      assert.notEqual(res.status, 500, `Server crashed (500) on input: ${attack}`);
      assert.notEqual(res.status, 502, `Edge crashed (502) on input: ${attack}`);
    }
  });

  await t.test('HTTP Verb Stress: Unsupported methods (DELETE, PUT) return 405 Method Not Allowed', async () => {
    const deleteRes = await rawFetch(`${origin}/mcp`, {
      method: 'DELETE',
      headers: authenticatedHeaders
    });
    assert.ok(
      [405, 400, 404].includes(deleteRes.status),
      `Expected HTTP 405/400 for DELETE /mcp, got ${deleteRes.status}`
    );

    const putRes = await rawFetch(`${origin}/mcp`, {
      method: 'PUT',
      headers: authenticatedHeaders,
      body: JSON.stringify({ jsonrpc: '2.0' })
    });
    assert.ok(
      [405, 400, 404].includes(putRes.status),
      `Expected HTTP 405/400 for PUT /mcp, got ${putRes.status}`
    );
  });
});

// ============================================================================
// SUITE 3: TOOL DISCOVERY, SCHEMA VALIDATION & LIVE INVOCATIONS
// ============================================================================
test('Tool Discovery: Exactly 42 tools with compliant JSON schemas on both origins', async (t) => {
  if (!hasLiveMcpCredentials) {
    t.skip('Skipping live authenticated MCP probe: CF Access + TRINITY_MCP_API_KEY not configured in environment');
    return;
  }
  for (const origin of TARGET_ORIGINS) {
    await t.test(`${origin} returns exactly ${EXPECTED_TOOL_COUNT} tools with valid schemas`, async () => {
      const res = await rawFetch(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          ...cfHeaders,
          Authorization: `Bearer ${mcpToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream'
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 301, method: 'tools/list', params: {} })
      });

      assert.equal(res.status, 200, `Expected HTTP 200 on ${origin}/mcp tools/list, got ${res.status}`);
      assert.ok(res.json?.result?.tools, `Response must contain tools array: ${res.text.slice(0, 200)}`);
      const tools = res.json.result.tools;
      assert.equal(tools.length, EXPECTED_TOOL_COUNT, `Expected exactly ${EXPECTED_TOOL_COUNT} tools, found ${tools.length}`);

      // Verify schema integrity for every single tool
      const seenNames = new Set();
      for (const tool of tools) {
        assert.ok(typeof tool.name === 'string' && tool.name.length > 0, `Tool name must be non-empty string: ${JSON.stringify(tool)}`);
        assert.ok(!seenNames.has(tool.name), `Duplicate tool name detected: ${tool.name}`);
        seenNames.add(tool.name);

        assert.ok(typeof tool.description === 'string', `Tool ${tool.name} must have a description`);
        assert.ok(typeof tool.inputSchema === 'object' && tool.inputSchema !== null, `Tool ${tool.name} must have inputSchema object`);
        assert.equal(tool.inputSchema.type, 'object', `Tool ${tool.name} inputSchema.type must be 'object'`);
      }
    });
  }
});

test('Tool Catalog Alignment: Remote catalog matches Trinity/scripts/trinity-codex-mcp.mjs registry', async () => {
  // Read local bridge file and extract registered tool names
  const localBridgePath = path.resolve(fileURLToPath(new URL('../Trinity/scripts/trinity-codex-mcp.mjs', import.meta.url)));
  assert.ok(fs.existsSync(localBridgePath), `Bridge script not found at ${localBridgePath}`);
  const bridgeCode = fs.readFileSync(localBridgePath, 'utf8');

  // Match all server.registerTool('name', ...)
  const toolNameMatches = [...bridgeCode.matchAll(/server\.registerTool\(\s*['"]([a-zA-Z0-9_-]+)['"]/g)].map(m => m[1]);
  assert.equal(toolNameMatches.length, EXPECTED_TOOL_COUNT, `Bridge file should register exactly ${EXPECTED_TOOL_COUNT} tools`);

  if (!hasLiveMcpCredentials) {
    return;
  }

  // Query live remote catalog
  const res = await rawFetch('https://auru.space/mcp', {
    method: 'POST',
    headers: {
      ...cfHeaders,
      Authorization: `Bearer ${mcpToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 302, method: 'tools/list', params: {} })
  });

  const remoteNames = new Set(res.json.result.tools.map(t => t.name));
  for (const name of toolNameMatches) {
    assert.ok(remoteNames.has(name), `Registered tool '${name}' in trinity-codex-mcp.mjs is missing from remote catalog`);
  }
});

test('Safe Tool Invocations: diagnostic_ping and read-only tools execute correctly', async (t) => {
  if (!hasLiveMcpCredentials) {
    t.skip('Skipping live authenticated MCP probe: CF Access + TRINITY_MCP_API_KEY not configured in environment');
    return;
  }
  const origin = 'https://auru.space';
  const authenticatedHeaders = {
    ...cfHeaders,
    Authorization: `Bearer ${mcpToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };

  await t.test('diagnostic_ping executes and returns valid diagnostic response', async () => {
    const pingId = 'adversarial-test-ping-' + Date.now();
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 401,
        method: 'tools/call',
        params: {
          name: 'diagnostic_ping',
          arguments: { message: pingId }
        }
      })
    });
    assert.equal(res.status, 200);
    assert.ok(res.json?.result, `Expected result in diagnostic_ping response, got: ${res.text}`);
    assert.ok(!res.json?.error, `Unexpected error in diagnostic_ping: ${JSON.stringify(res.json?.error)}`);
  });

  await t.test('trinity_status executes safely and returns verified status', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 402,
        method: 'tools/call',
        params: { name: 'trinity_status', arguments: {} }
      })
    });
    assert.equal(res.status, 200);
    assert.ok(res.json?.result, `Expected result in trinity_status response, got: ${res.text}`);
  });

  await t.test('infrastructure_status executes safely and returns binding health', async () => {
    const res = await rawFetch(`${origin}/mcp`, {
      method: 'POST',
      headers: authenticatedHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 403,
        method: 'tools/call',
        params: { name: 'infrastructure_status', arguments: {} }
      })
    });
    assert.equal(res.status, 200);
    assert.ok(res.json?.result, `Expected result in infrastructure_status response, got: ${res.text}`);
  });
});

// ============================================================================
// SUITE 4: LOCAL CLIENT & BRIDGE ERROR HANDLING STRESS TESTS
// ============================================================================
test('Local Bridge Response Parser Resilience', () => {
  // Test SSE parsing logic used in trinity-codex-mcp.mjs and verify-codex-mcp-access.mjs
  function parseRemoteResponse(text) {
    const lines = text.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).filter(Boolean);
    const payload = lines.length ? JSON.parse(lines.at(-1)) : JSON.parse(text);
    if (payload.error) throw new Error(payload.error.message || 'Trinity MCP request failed.');
    return payload.result;
  }

  // 1. Standard JSON payload
  const plainJson = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { success: true } });
  assert.deepEqual(parseRemoteResponse(plainJson), { success: true });

  // 2. Single SSE data line
  const singleSse = `data: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result: { status: 'ok' } })}`;
  assert.deepEqual(parseRemoteResponse(singleSse), { status: 'ok' });

  // 3. Multi-line SSE stream
  const multiSse = `event: message\ndata: {"status": "in_progress"}\n\nevent: message\ndata: {"jsonrpc": "2.0", "result": {"final": true}}\n\n`;
  assert.deepEqual(parseRemoteResponse(multiSse), { final: true });

  // 4. Remote JSON-RPC error payload
  const errPayload = JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } });
  assert.throws(() => parseRemoteResponse(errPayload), /Method not found/);

  // 5. Corrupt text
  assert.throws(() => parseRemoteResponse('corrupt non-json content'), SyntaxError);
});

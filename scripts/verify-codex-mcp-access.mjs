#!/usr/bin/env node
import {accessHeaders, resolveEnvCredentials, validateOrigin} from './lib/cloudflare-access.mjs';

const TARGET_ORIGINS = ['https://auru.space', 'https://auru.dev'];
const EXPECTED_TOOL_COUNT = 42;

async function runProbe(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000)
  });
  const location = response.headers.get('location') || '';
  const isAccessRedirect = response.status === 302 && location.includes('.cloudflareaccess.com');
  const text = await response.text();
  let json = null;
  try {
    const dataLines = text.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean);
    json = dataLines.length ? JSON.parse(dataLines.at(-1)) : JSON.parse(text);
  } catch {
    // Non-JSON response
  }
  return { status: response.status, location, isAccessRedirect, text, json };
}

async function verifyOrigin(origin, env) {
  origin = validateOrigin(origin);
  const results = {
    origin,
    anonymousBlocked: false,
    authenticatedPassed: false,
    mcpInitialized: false,
    mcpToolsListed: false,
    toolsCount: 0,
    diagnosticPingPassed: false,
    errors: []
  };

  const cfHeaders = accessHeaders(env);
  const mcpToken = env.TRINITY_MCP_API_KEY || env.TRINITY_MCP_TOKEN;

  // 1. Anonymous probe on /health (should be intercepted by Cloudflare Access -> 302)
  try {
    const anon = await runProbe(origin + '/health');
    if (anon.isAccessRedirect) {
      results.anonymousBlocked = true;
    } else {
      results.errors.push(`Expected anonymous probe to return HTTP 302 Cloudflare Access redirect, got HTTP ${anon.status}`);
    }
  } catch (err) {
    results.errors.push(`Anonymous probe failed: ${err.message}`);
  }

  // 2. Authenticated probe on /health (should pass through Access -> 200 OK)
  try {
    const auth = await runProbe(origin + '/health', { headers: { ...cfHeaders, Accept: 'application/json' } });
    const ready = await runProbe(origin + '/ready', { headers: { ...cfHeaders, Accept: 'application/json' } });
    if (auth.status === 200 && (auth.json?.status === 'serving' || auth.json?.version) && ready.status === 200 && ready.json?.ready === true) {
      results.authenticatedPassed = true;
      results.version = auth.json.version;
      results.environment = auth.json.environment;
      results.agents = auth.json.agents;
    } else {
      results.errors.push(`Expected authenticated probe to return HTTP 200 OK with serving/ready status (health: ${auth.status}, ready: ${ready.status})`);
    }
  } catch (err) {
    results.errors.push(`Authenticated probe failed: ${err.message}`);
  }

  // 3. MCP JSON-RPC 2.0 initialize probe
  const mcpHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    ...cfHeaders,
    Authorization: `Bearer ${mcpToken}`
  };

  try {
    const initPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'codex-mcp-verification', version: '1.0.0' }
      }
    };
    const initRes = await runProbe(origin + '/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify(initPayload)
    });

    if (initRes.status === 200 && initRes.json?.result?.serverInfo?.name === 'trinity') {
      results.mcpInitialized = true;
      results.serverInfo = initRes.json.result.serverInfo;
      results.protocolVersion = initRes.json.result.protocolVersion;
    } else {
      results.errors.push(`MCP initialize probe failed: HTTP ${initRes.status}, body: ${initRes.text?.slice(0, 150)}`);
    }
  } catch (err) {
    results.errors.push(`MCP initialize request failed: ${err.message}`);
  }

  // 4. MCP JSON-RPC 2.0 tools/list probe
  try {
    const toolsPayload = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    const toolsRes = await runProbe(origin + '/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify(toolsPayload)
    });

    if (toolsRes.status === 200 && Array.isArray(toolsRes.json?.result?.tools)) {
      results.mcpToolsListed = true;
      results.toolsCount = toolsRes.json.result.tools.length;
      results.toolNames = toolsRes.json.result.tools.map(t => t.name);
      if (results.toolsCount !== EXPECTED_TOOL_COUNT) {
        results.errors.push(`Expected ${EXPECTED_TOOL_COUNT} tools, found ${results.toolsCount}`);
      }
    } else {
      results.errors.push(`MCP tools/list probe failed: HTTP ${toolsRes.status}, body: ${toolsRes.text?.slice(0, 150)}`);
    }
  } catch (err) {
    results.errors.push(`MCP tools/list request failed: ${err.message}`);
  }

  // 5. MCP diagnostic_ping execution
  try {
    const pingPayload = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'diagnostic_ping',
        arguments: { message: 'verification-ping' }
      }
    };
    const pingRes = await runProbe(origin + '/mcp', {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify(pingPayload)
    });

    if (pingRes.status === 200 && (pingRes.json?.result || !pingRes.json?.error)) {
      results.diagnosticPingPassed = true;
    } else {
      results.errors.push(`MCP diagnostic_ping call failed: HTTP ${pingRes.status}, body: ${pingRes.text?.slice(0, 150)}`);
    }
  } catch (err) {
    results.errors.push(`MCP diagnostic_ping request failed: ${err.message}`);
  }

  results.success = results.anonymousBlocked &&
                    results.authenticatedPassed &&
                    results.mcpInitialized &&
                    results.mcpToolsListed &&
                    results.toolsCount === EXPECTED_TOOL_COUNT &&
                    results.diagnosticPingPassed &&
                    results.errors.length === 0;

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  let requestedOrigin = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--origin' && args[i + 1]) requestedOrigin = args[++i];
  }

  const origins = requestedOrigin ? [requestedOrigin] : TARGET_ORIGINS;
  const env = resolveEnvCredentials(process.env);

  console.log('='.repeat(70));
  console.log('TRINITY CODEX MCP & CLOUDFLARE ACCESS VERIFICATION');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Cloudflare Access Client ID: ${env.CLOUDFLARE_ACCESS_CLIENT_ID ? 'Configured [REDACTED]' : 'MISSING'}`);
  console.log(`Cloudflare Access Client Secret: ${env.CLOUDFLARE_ACCESS_CLIENT_SECRET ? 'Configured [REDACTED]' : 'MISSING'}`);
  console.log(`Trinity MCP API Key: ${(env.TRINITY_MCP_API_KEY || env.TRINITY_MCP_TOKEN) ? 'Configured [REDACTED]' : 'MISSING'}`);
  console.log('-'.repeat(70));

  let overallSuccess = true;

  for (const origin of origins) {
    console.log(`\nProbing Target: ${origin}`);
    const res = await verifyOrigin(origin, env);

    console.log(`  [1] Edge Zero Trust Perimeter: ${res.anonymousBlocked ? 'PASS (HTTP 302 intercepted)' : 'FAIL'}`);
    console.log(`  [2] Service Auth Authentication: ${res.authenticatedPassed ? 'PASS (HTTP 200 OK)' : 'FAIL'}`);
    console.log(`  [3] MCP Handshake (initialize): ${res.mcpInitialized ? `PASS (${res.serverInfo?.name} v${res.serverInfo?.version})` : 'FAIL'}`);
    console.log(`  [4] MCP Tool Catalog (tools/list): ${res.mcpToolsListed ? `PASS (${res.toolsCount}/${EXPECTED_TOOL_COUNT} tools registered)` : 'FAIL'}`);
    console.log(`  [5] Safe Tool Invocation (diagnostic_ping): ${res.diagnosticPingPassed ? 'PASS (Executed successfully)' : 'FAIL'}`);

    if (!res.success) {
      overallSuccess = false;
      console.log('  Errors:');
      for (const err of res.errors) {
        console.log(`    - ${err}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  if (overallSuccess) {
    console.log('RESULT: ALL MCP AND CLOUDFLARE ACCESS CHECKS PASSED (100%)');
    console.log('='.repeat(70));
    process.exit(0);
  } else {
    console.log('RESULT: VERIFICATION FAILED');
    console.log('='.repeat(70));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal verification runner error:', err.message);
  process.exit(1);
});

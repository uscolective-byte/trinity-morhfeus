import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));

const subpaths = [
  '@modelcontextprotocol/sdk/client/index.js',
  '@modelcontextprotocol/sdk/client/sse.js',
  '@modelcontextprotocol/sdk/client/stdio.js',
  '@modelcontextprotocol/sdk/server/index.js',
  '@modelcontextprotocol/sdk/server/sse.js',
  '@modelcontextprotocol/sdk/server/stdio.js',
  '@modelcontextprotocol/sdk/types.js'
];

test('root ESM dynamic imports of all MCP SDK submodules succeed', async () => {
  for (const sp of subpaths) {
    const mod = await import(sp);
    assert.ok(mod, `Failed to load ${sp}`);
  }
});

test('root CommonJS require.resolve of all MCP SDK submodules succeed', () => {
  const req = createRequire(resolve(root, 'package.json'));
  for (const sp of subpaths) {
    const target = req.resolve(sp);
    assert.ok(target, `Failed to resolve ${sp}`);
  }
});

test('deeply nested paths can resolve and import MCP SDK without error', async () => {
  const deepDir = resolve(root, 'tests/stress/.temp_deep/level1/level2/level3');
  mkdirSync(deepDir, { recursive: true });
  try {
    const testFile = resolve(deepDir, 'probe.mjs');
    writeFileSync(testFile, `
      import { Client } from '@modelcontextprotocol/sdk/client/index.js';
      import { Server } from '@modelcontextprotocol/sdk/server/index.js';
      import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
      export const ok = typeof Client === 'function' && typeof Server === 'function' && typeof StdioClientTransport === 'function';
    `, 'utf8');

    const mod = await import(`file://${testFile.replace(/\\/g, '/')}`);
    assert.equal(mod.ok, true, 'Import from deeply nested directory failed');
  } finally {
    rmSync(resolve(root, 'tests/stress/.temp_deep'), { recursive: true, force: true });
  }
});

test('MCP SDK Client and Server instances can be initialized and configured', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');

  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  assert.equal(client.constructor.name, 'Client');

  const server = new Server({ name: 'test-server', version: '1.0.0' }, { capabilities: { tools: {} } });
  assert.equal(server.constructor.name, 'Server');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

test('stdio initializes without an HTTP token and serves bridge status', {timeout: 15000}, async () => {
  const server = fileURLToPath(new URL('../server.mjs', import.meta.url));
  const workspace = path.resolve(path.dirname(server), '..');
  const env = {...process.env, NODE_ENV: 'production', MCP_STDIO: 'true', TRINITY_WORKSPACE: workspace};
  delete env.TRINITY_TOKEN;
  const transport = new StdioClientTransport({command: process.execPath, args: [server], env, stderr: 'pipe'});
  const client = new Client({name: 'trinity-stdio-regression', version: '1.0.0'});
  let diagnostics = '';
  transport.stderr?.on('data', chunk => {diagnostics += chunk.toString();});
  try {
    await client.connect(transport);
    const catalog = await client.listTools();
    assert.ok(catalog.tools.some(tool => tool.name === 'trinity_bridge_status'));
    const result = await client.callTool({name: 'trinity_bridge_status', arguments: {}});
    assert.ok(!result.isError);
    const status = JSON.parse(result.content.find(item => item.type === 'text').text);
    assert.equal(status.status, 'ready');
    assert.equal(status.workspace, workspace);
    assert.doesNotMatch(diagnostics, /HTTP brána beží/);
  } finally {
    await client.close();
  }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('four project clients share bounded MCP scope without embedded credentials', () => {
  const raw = read('config/project-mcp-clients.json');
  const config = JSON.parse(raw);
  assert.deepEqual(config.clients.map(c => c.id), ['chatgpt', 'gemini', 'copilot', 'notion']);
  assert.deepEqual(config.scopes, ['mcp:read', 'mcp:write']);
  assert.equal(config.endpoint, 'https://auru.space/mcp');
  assert.equal(config.separate_credentials, true);
  assert.equal(config.owner_approval_for_sensitive_actions, true);
  assert.equal(config.credential_lifetime_days, 90);
  assert.equal(config.rate_limit_per_minute, 60);
  assert.ok(config.clients.every(c => c.credential_file === `${c.id}-mcp.dpapi`));
  assert.ok(!raw.includes('trn_live_'));
  assert.ok(config.clients.filter(c => c.id !== 'gemini').every(c => !['connected', 'verified'].includes(c.connection_status)));
});

test('Windows provisioner preserves existing files and limits new keys to project MCP scope', () => {
  const script = read('scripts/provision-project-clients.ps1');
  assert.ok(script.includes("[ValidateSet('chatgpt', 'gemini', 'copilot', 'notion')]"));
  assert.ok(script.includes('Unexpected Cloudflare account or database'));
  assert.ok(script.includes('Test-Path -LiteralPath $credentialPath'));
  assert.ok(script.includes('No key rotation or permission change'));
  assert.ok(script.includes('ConvertFrom-SecureString'));
  assert.ok(script.includes("json_array('mcp:read','mcp:write')"));
  assert.ok(!script.includes("'api:invoke'"));
  assert.ok(!script.includes('$Rotate'));
  assert.ok(script.includes('AddDays(90)'));
  assert.ok(script.includes("SET status='revoked'"));
  assert.ok(script.includes('--config wrangler.jsonc'));
  assert.ok(!/Write-(?:Host|Output|Warning).*\$(?:secret|plain)\b/i.test(script));
  assert.ok(read('../.gitignore').includes('**/.credentials/'));
});

test('clipboard helper requires one explicit client and never prints the secret', () => {
  const script = read('scripts/copy-project-client-token.ps1');
  assert.ok(script.includes('[Parameter(Mandatory = $true)]'));
  assert.ok(script.includes('Set-Clipboard'));
  assert.ok(script.includes('ZeroFreeBSTR'));
  assert.ok(script.includes('never into chat'));
  assert.ok(!/Write-(?:Host|Output|Warning).*\$(?:secret|plain)\b/i.test(script));
});

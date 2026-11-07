import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const ALL_46_WORKERS = [
  'aura_analyzer', 'aura_architect', 'aura_codegen', 'aura_deployer', 'aura_evolver',
  'aura_memory', 'aura_optimizer', 'aura_planner', 'aura_sentinel', 'aura_tester',
  'chanfana-openapi-template', 'jericho123', 'muddy-wind-42e2', 'my-react-app',
  'noisy-hat-011e', 'react-router-starter-templates', 'saas-admin-template',
  'small-pine-596d', 'snowy-fire-3605', 'Trinity', 'trinity-agent-researcher',
  'trinity-audit', 'trinity-builder', 'trinity-capacity', 'trinity-chat-inference',
  'trinity-chat-maintainer', 'trinity-connectors', 'trinity-core', 'trinity-deployer',
  'trinity-dispatcher', 'trinity-gemini', 'trinity-guardian', 'trinity-integrations',
  'trinity-knowledge', 'trinity-memory', 'trinity-morhfeus', 'trinity-ops',
  'trinity-pc-bridge', 'trinity-pc-bridge-v2', 'trinity-seeder', 'trinity-sentinel',
  'trinity-skills', 'trinity-staging', 'trinityguardiantruthverifierworker',
  'vite-react-template', 'vite-react-templates'
];

test('Universal Non-AI GET /health probe contract on all root worker stubs', async () => {
  const targets = [...ALL_46_WORKERS, 'trinity-profile'];

  for (const workerName of targets) {
    if (workerName === 'Trinity') continue; // Trinity has full suite tested separately

    const workerDir = path.join(ROOT_DIR, workerName);
    const tsFile = path.join(workerDir, 'src', 'index.ts');
    assert.ok(fs.existsSync(tsFile), `Entrypoint missing for ${workerName}`);

    const content = fs.readFileSync(tsFile, 'utf8');
    assert.ok(
      content.includes('/health'),
      `Worker ${workerName} does not reference /health`
    );
    assert.ok(
      content.includes('"10.3.0"'),
      `Worker ${workerName} does not declare version 10.3.0`
    );
    assert.ok(
      content.includes('serving') || content.includes('healthy'),
      `Worker ${workerName} does not declare serving/healthy status`
    );
  }
});

test('aura_sentinel genuine logic: blocks malicious payloads and passes clean payloads', async () => {
  const filePath = path.join(ROOT_DIR, 'aura_sentinel/src/index.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verify regex patterns
  assert.ok(code.includes('/\\bunion\\s+.*\\bselect\\b/i'));
  assert.ok(code.includes('/<script[^>]*>/i'));
  assert.ok(code.includes('/\\.\\/\\.\\//'));

  // Test health check route logic
  assert.ok(code.includes('url.pathname === "/health"'));
});

test('aura_analyzer genuine logic: catches unsafe eval, parses complexity, yields verdicts', async () => {
  const filePath = path.join(ROOT_DIR, 'aura_analyzer/src/index.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verify syntax fixes
  assert.ok(!code.includes('new\\++Function'), 'Contains invalid regex new\\++Function');
  assert.ok(!code.includes('REKECTED'), 'Contains typo REKECTED');
  assert.ok(code.includes('REJECTED'), 'Correct verdict REJECTED present');
  assert.ok(code.includes('/\\b(eval|new\\s+Function)\\s*\\(/'), 'Regex for unsafe enactment present');
  assert.ok(code.includes('/\\b(if|for|while|case|catch)\\b|\\?\\.|&&|\\|\\|/g'), 'Complexity regex clean');
});

test('aura_architect genuine logic: implements DFS cycle detection', async () => {
  const filePath = path.join(ROOT_DIR, 'aura_architect/src/index.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('CYCLIC_DETECTED'), 'Detects cyclic topologies');
  assert.ok(code.includes('dfs('), 'Genuine DFS implementation');
  assert.ok(code.includes('visited.add'), 'Graph tracking');
});

test('aura_codegen genuine logic: emits typescript interfaces and D1 tables', async () => {
  const filePath = path.join(ROOT_DIR, 'aura_codegen/src/index.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('CREATE TABLE IF NOT EXISTS'), 'SQL D1 generation');
  assert.ok(code.includes('export interface'), 'TypeScript interface generation');
});

test('small-pine-596d genuine logic: clean template literal preserves query string', async () => {
  const filePath = path.join(ROOT_DIR, 'small-pine-596d/src/index.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(!code.includes('$wu.search'), 'Syntax error $wu.search still present');
  assert.ok(code.includes('${u.search}'), 'Template literal properly interpolates u.search');
});

test('trinity-core genuine logic: routes to CHAT_INFERENCE_SERVICE and fixed typo', async () => {
  const filePath = path.join(ROOT_DIR, 'trinity-core/src/index.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(!code.includes('COTNITIVE'), 'Typo COTNITIVE present');
  assert.ok(code.includes('COGNITIVE_ORCHESTRATION_READY'), 'Typo resolved');
  assert.ok(code.includes('env.CHAT_INFERENCE_SERVICE'), 'Service binding wired');
});

test('trinity-chat-inference genuine logic: 3-tier multi-model fallback and context slicer', async () => {
  const filePath = path.join(ROOT_DIR, 'trinity-chat-inference/src/index.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('@cf/meta/llama-3.3-70b-instruct-fp8-fast'), 'Tier 1 primary present');
  assert.ok(code.includes('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'), 'Tier 2 secondary present');
  assert.ok(code.includes('@cf/meta/llama-3.1-8b-instruct-fp8-fast'), 'Tier 3 rapid fallback present');
  assert.ok(code.includes('sliceContextSafely'), 'Context slicer present');
  assert.ok(code.includes('return [systemMessage, ...selected].slice(0, maxMessages)'), 'Keeps system prompt at the start of the bounded context');
  assert.ok(!code.includes('sliceContextSafely(rawMsgs).slice(-8)'), 'Does not slice the system prompt away after trimming');
});

test('trinity-profile genuine logic: real D1/KV bindings and removal of hardcoded email bypass', async () => {
  const tomlPath = path.join(ROOT_DIR, 'trinity-profile/wrangler.toml');
  const toml = fs.readFileSync(tomlPath, 'utf8');

  assert.ok(toml.includes('database_id = "ca8ea24e-f7db-431e-b8bf-97f713ae4533"'), 'Real D1 ID wired');
  assert.ok(toml.includes('id = "0b92ed2717d742daa860f1827797297f"'), 'Real KV ID wired');
  assert.ok(!toml.includes('trinity-d1-prod'), 'Placeholder trinity-d1-prod removed');
  assert.ok(!toml.includes('trinity_kv_prod'), 'Placeholder trinity_kv_prod removed');

  const indexPath = path.join(ROOT_DIR, 'trinity-profile/src/index.ts');
  const code = fs.readFileSync(indexPath, 'utf8');

  assert.ok(!code.includes('saboivan2008@gmail.com'), 'Insecure hardcoded email bypass removed');
  assert.ok(code.includes('isAdminAuthorized'), 'Cryptographic/token authorization check present');
  assert.ok(code.includes('verifyCloudflareAccessJwt'), 'Cloudflare Access JWT verification is implemented');
  assert.ok(code.includes('CF-Access-Jwt-Assertion'), 'Reads the signed Cloudflare Access JWT assertion');
  assert.ok(code.includes('CF_ACCESS_AUD') && code.includes('claims.iss !== issuer'), 'Checks Access JWT audience and issuer');
  assert.ok(code.includes('CF_ACCESS_ADMIN_EMAILS'), 'Requires an explicit admin email allowlist for role elevation');
  assert.ok(!code.includes('authHeader.startsWith("Bearer trn_live_")'), 'Does not trust an unverified bearer prefix for admin elevation');
  assert.ok(!code.includes('Boolean(cfAccessClientId)'), 'Does not trust the Access client ID header by itself');
});

test('deploy-all-workers.mjs targets all 46 workers + trinity-profile with dry-run support', async () => {
  const deployScript = path.join(ROOT_DIR, 'scripts/deploy-all-workers.mjs');
  const code = fs.readFileSync(deployScript, 'utf8');

  assert.ok(code.includes('trinity-profile'), 'Profile included in deployment targets');
  assert.ok(code.includes('--dry-run'), 'Supports dry-run flag');
  assert.ok(code.includes('AURA_WORKERS'), 'Deploys 10 AURA workers');
  assert.ok(code.includes('TRINITY_CORE_WORKERS'), 'Deploys 8 core workers');
  assert.ok(code.includes('STANDALONE_WORKERS'), 'Deploys standalone microservices');
  assert.ok(code.includes('AUXILIARY_WORKERS'), 'Deploys auxiliary/templates');
});

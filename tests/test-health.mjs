import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const workers = [
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
  'vite-react-template', 'vite-react-templates', 'trinity-profile'
];

let passCount = 0;
let failCount = 0;

for (const w of workers) {
  const p = path.join(rootDir, w, 'src', 'index.ts');
  if (!fs.existsSync(p)) {
    console.error(`MISSING: ${p}`);
    failCount++;
    continue;
  }

  // Read content and verify standard /health response pattern
  const content = fs.readFileSync(p, 'utf8');
  const hasHealthPath = content.includes('pathname === "/health"') || content.includes('pathname === "/health" || url.pathname === "/api/health"');
  const hasOkTrue = content.includes('ok: true') || content.includes('ok: missing.length === 0');
  const hasVersion = content.includes('"10.3.0"');
  const hasServing = content.includes('"serving"');

  if (hasHealthPath && hasOkTrue && hasVersion && hasServing) {
    console.log(`PASS: ${w.padEnd(36)} -> standard GET /health compliant (10.3.0)`);
    passCount++;
  } else {
    console.error(`FAIL: ${w.padEnd(36)} -> missing health contract elements`);
    failCount++;
  }
}

console.log(`\nHealth Check Verification: ${passCount} PASSED, ${failCount} FAILED`);
if (failCount > 0) process.exit(1);

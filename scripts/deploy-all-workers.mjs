#!/usr/bin/env node
/**
 * Trinity Autonomous Fleet - Deploy All Workers Script
 * Deploys all 23 specialized workers + Trinity main worker to Cloudflare Edge.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

const AURA_WORKERS = [
  'aura_analyzer', 'aura_architect', 'aura_codegen', 'aura_deployer', 'aura_evolver',
  'aura_memory', 'aura_optimizer', 'aura_planner', 'aura_sentinel', 'aura_tester'
];

const TRINITY_CORE_WORKERS = [
  'trinity-core', 'trinity-builder', 'trinity-dispatcher', 'trinity-connectors',
  'trinity-guardian', 'trinity-memory', 'trinity-sentinel', 'trinity-skills'
];

const STANDALONE_WORKERS = [
  { name: 'trinity-capacity', dir: 'Capacity-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-knowledge', dir: 'Knowledge-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-integrations', dir: 'Integrations-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-pc-bridge', dir: 'PC-Bridge-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-audit', dir: 'Audit-Worker', config: 'wrangler.jsonc' }
];

console.log('====================================================');
console.log('🚀 TRINITY FULL FLEET DEPLOYMENT (23 WORKERS + CORE)');
console.log('====================================================');

const results = [];

function deployWorker(name, cwd, configPath) {
  console.log(`\n⏳ Deploying ${name}...`);
  const fullConfig = resolve(cwd, configPath);
  if (!existsSync(fullConfig)) {
    console.error(`❌ Missing config: ${fullConfig}`);
    results.push({ name, success: false, error: 'Config missing' });
    return false;
  }

  try {
    const cmd = `npx wrangler deploy --config "${fullConfig}"`;
    console.log(`   Running: ${cmd} (in ${cwd})`);
    const output = execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
    console.log(`✅ ${name} deployed successfully!`);
    results.push({ name, success: true, output });
    return true;
  } catch (err) {
    const msg = err.stdout?.toString() || err.stderr?.toString() || err.message;
    console.warn(`⚠️ Deployment issue for ${name}: ${msg.slice(0, 300)}`);
    results.push({ name, success: false, error: msg });
    return false;
  }
}

// 1. Deploy 10 AURA workers
console.log('\n--- PHASE 1: Deploying 10 AURA Specialists ---');
const auraDir = resolve(ROOT_DIR, 'Trinity/workers/aura');
for (const role of AURA_WORKERS) {
  deployWorker(role, auraDir, `${role}.jsonc`);
}

// 2. Deploy 8 Trinity Core workers
console.log('\n--- PHASE 2: Deploying 8 Trinity Core Workers ---');
const trinityDir = resolve(ROOT_DIR, 'Trinity/workers/trinity');
for (const w of TRINITY_CORE_WORKERS) {
  deployWorker(w, trinityDir, `${w}.jsonc`);
}

// 3. Deploy Standalone workers
console.log('\n--- PHASE 3: Deploying Standalone Workers ---');
for (const w of STANDALONE_WORKERS) {
  const dir = resolve(ROOT_DIR, w.dir);
  deployWorker(w.name, dir, w.config);
}

// 4. Deploy Trinity Main Worker
console.log('\n--- PHASE 4: Deploying Trinity Main Worker ---');
const trinityMainDir = resolve(ROOT_DIR, 'Trinity');
deployWorker('trinity-main', trinityMainDir, 'wrangler.jsonc');

console.log('\n====================================================');
console.log('📊 DEPLOYMENT SUMMARY');
console.log('====================================================');
let successCount = 0;
for (const r of results) {
  const status = r.success ? '✅ SUCCESS' : '⚠️ WARNING / ERROR';
  console.log(`${status} - ${r.name}`);
  if (r.success) successCount++;
}
console.log(`\nTotal: ${successCount} / ${results.length} workers successfully deployed.`);

if (successCount === 0) {
  console.error('\n❌ No workers deployed. Check Cloudflare authentication or network.');
  process.exit(1);
} else {
  console.log('\n🎉 Deployment complete.');
  process.exit(0);
}

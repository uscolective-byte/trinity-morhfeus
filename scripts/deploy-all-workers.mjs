#!/usr/bin/env node
/**
 * Trinity Autonomous Fleet - Deploy All Workers Script
 * Deploys all 23 specialized workers + Trinity main worker to Cloudflare Edge.
 */

import { execFileSync } from 'node:child_process';
import {checkSource} from './source-policy.mjs';
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
  { name: 'trinity-audit', dir: 'Audit-Worker', config: 'wrangler.jsonc' },
  { name: 'jericho123', dir: 'Jericho-Worker', config: 'wrangler.jsonc' }
];

console.log('====================================================');
console.log('🚀 TRINITY FULL FLEET DEPLOYMENT (23 WORKERS + CORE)');
console.log('====================================================');

const results = [];
checkSource(ROOT_DIR);
const releaseSha=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT_DIR,encoding:'utf8'}).trim();
const npmCli=process.env.npm_execpath;
if(!npmCli)throw new Error('Run through npm run deploy:all.');
execFileSync(process.execPath,[npmCli,'run','check'],{cwd:ROOT_DIR,stdio:'inherit'});
const wrangler=resolve(ROOT_DIR,'Trinity/node_modules/wrangler/bin/wrangler.js');

function deployWorker(name, cwd, configPath, env = "") {
  console.log(`\n⏳ Deploying ${name}...`);
  const fullConfig = resolve(cwd, configPath);
  if (!existsSync(fullConfig)) {
    console.error(`❌ Missing config: ${fullConfig}`);
    results.push({ name, success: false, error: 'Config missing' });
    return false;
  }

  try {
    const output = execFileSync(process.execPath,[wrangler,'deploy','--config',fullConfig,'--env',env,'--tag',releaseSha], { cwd, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
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

// Only promote the main application after every dependency deploy succeeded.
if(results.some(result=>!result.success)) {
  console.error('Dependency deployment failed; main application was not promoted.');
  process.exit(1);
}
const bash=process.platform==='win32'?resolve(process.env.ProgramFiles||'C:/Program Files','Git/bin/bash.exe'):'bash';
// Guarded rollout backs up both databases, applies migrations, deploys development,
// verifies its SHA/readiness, then deploys and verifies production.
execFileSync(bash,[resolve(ROOT_DIR,'scripts/trinity-environment.sh'),'deploy'],{cwd:ROOT_DIR,stdio:'inherit'});

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

if (successCount !== results.length) {
  console.error('\n❌ No workers deployed. Check Cloudflare authentication or network.');
  process.exit(1);
} else {
  console.log('\n🎉 Deployment complete.');
  process.exit(0);
}

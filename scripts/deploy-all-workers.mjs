#!/usr/bin/env node
/**
 * Build or deploy the canonical Trinity Worker fleet.
 *
 * Safe default: dry-run every target. A production deploy requires both
 * --deploy and --confirm-production and passes a full source/config preflight
 * before the first Worker is published.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkSource } from './source-policy.mjs';
import {
  WORKER_DEPLOYMENTS,
  AURA_WORKERS,
  TRINITY_CORE_WORKERS,
  STANDALONE_WORKERS,
  AUXILIARY_WORKERS,
  PROFILE_WORKER
} from './lib/worker-deployments.mjs';

// Canonical fleet includes all 46 Cloudflare workers plus trinity-profile (47 targets total).

const ROOT_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--deploy');
const DEPLOY = process.argv.includes('--deploy');
const CONFIRM_PRODUCTION = process.argv.includes('--confirm-production');
const HELP = process.argv.includes('--help') || process.argv.includes('-h');

function readMain(configPath) {
  const text = readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
  const match = configPath.endsWith('.toml')
    ? text.match(/^\s*main\s*=\s*["']([^"']+)["']/m)
    : text.match(/"main"\s*:\s*"([^"]+)"/);
  return match?.[1] || null;
}

if (HELP) {
  console.log('Usage: node scripts/deploy-all-workers.mjs [--dry-run | --deploy --confirm-production]');
  console.log(`Canonical targets: ${WORKER_DEPLOYMENTS.length}`);
  process.exit(0);
}

if (DEPLOY && !CONFIRM_PRODUCTION) {
  console.error('Refusing fleet deployment: pass --confirm-production after reviewing the target list and release evidence.');
  process.exit(2);
}

const issues = [];
for (const target of WORKER_DEPLOYMENTS) {
  const config = resolve(ROOT_DIR, target.dir, target.config);
  if (!existsSync(config)) {
    issues.push({ name: target.name, issue: `Missing config: ${config}` });
    continue;
  }
  const main = readMain(config);
  if (!main) {
    issues.push({ name: target.name, issue: `Config has no readable main entry: ${config}` });
    continue;
  }
  const entry = resolve(config, '..', main);
  if (!existsSync(entry)) issues.push({ name: target.name, issue: `Missing main entry: ${entry}` });
}

if (issues.length) {
  console.error('Preflight failed; no Worker was built or deployed:');
  for (const issue of issues) console.error(`- ${issue.name}: ${issue.issue}`);
  process.exit(1);
}

if (DEPLOY && !process.argv.includes('--skip-source-check')) {
  try {
    checkSource(ROOT_DIR);
  } catch (error) {
    console.error(`Source policy failed; no Worker was deployed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const CONTINUE_ON_ERROR = process.argv.includes('--continue-on-error');
const wranglerScript = resolve(ROOT_DIR, 'Trinity/node_modules/wrangler/bin/wrangler.js');
const useLocalWrangler = existsSync(wranglerScript);
const releaseTag = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
const results = [];

console.log(`TRINITY ${DRY_RUN ? 'DRY-RUN' : 'PRODUCTION DEPLOY'} — ${WORKER_DEPLOYMENTS.length} canonical targets`);
if (DRY_RUN) console.log('No Cloudflare deployments will be published.');

for (const target of WORKER_DEPLOYMENTS) {
  const config = resolve(ROOT_DIR, target.dir, target.config);
  const cwd = resolve(ROOT_DIR, target.dir);
  const args = ['deploy', '--config', config];
  if (target.env) args.push('--env', target.env);
  if (DRY_RUN) {
    args.push('--dry-run', '--outdir', resolve(tmpdir(), 'trinity-worker-builds', target.name));
  } else {
    args.push('--tag', releaseTag);
  }

  try {
    const command = useLocalWrangler
      ? [process.execPath, [wranglerScript, ...args]]
      : ['npx', ['wrangler', ...args]];
    const stdout = execFileSync(command[0], command[1], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }
    });
    const versionMatch = stdout.match(/Current Version ID:\s*([0-9a-f-]+)/i);
    const versionId = versionMatch ? versionMatch[1] : null;
    results.push({ name: target.name, ok: true, versionId });
    console.log(`PASS ${target.name}${versionId ? ` (Version ID: ${versionId})` : ''}`);
  } catch (error) {
    const message = error.stdout?.toString() || error.stderr?.toString() || error.message;
    results.push({ name: target.name, ok: false, message: message.slice(0, 500) });
    console.error(`FAIL ${target.name}: ${message.slice(0, 300)}`);
    if (!DRY_RUN && !CONTINUE_ON_ERROR) {
      console.error('Stopping after the first deployment error.');
      break;
    }
  }
}

const passed = results.filter(result => result.ok).length;
console.log(`Summary: ${passed}/${results.length} passed.`);
if (passed !== WORKER_DEPLOYMENTS.length && !CONTINUE_ON_ERROR) process.exit(1);

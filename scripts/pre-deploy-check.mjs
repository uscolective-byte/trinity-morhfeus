#!/usr/bin/env node
/**
 * @module TRINITY_PRE_DEPLOY_CHECK
 * @description Pre-deployment gate for production (auru.space / aura.space) and staging (auru.dev / aura.dev).
 * Verifies:
 * 1. Hermetic Wrangler environment separation (staging vs production)
 * 2. Root <-> Trinity wrangler.jsonc synchronization
 * 3. D1 Audit Ledger SQL migration presence (0057_audit_logs_ledger.sql)
 * 4. Secrets Store bindings doctor check
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function parseJsonc(raw) {
  const withoutBlock = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLine = withoutBlock.replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(withoutLine);
}

export function runPreDeployCheck() {
  const trinityWranglerPath = path.join(rootDir, 'Trinity', 'wrangler.jsonc');
  const rootWranglerPath = path.join(rootDir, 'wrangler.jsonc');
  const migrationPath = path.join(rootDir, 'Trinity', 'migrations', '0057_audit_logs_ledger.sql');
  const bridgePath = path.join(rootDir, 'scripts', 'desktop-commander-bridge', 'bridge.js');

  if (!fs.existsSync(trinityWranglerPath)) {
    throw new Error('Chýba Trinity/wrangler.jsonc');
  }
  if (!fs.existsSync(rootWranglerPath)) {
    throw new Error('Chýba koreňový wrangler.jsonc');
  }
  if (!fs.existsSync(migrationPath)) {
    throw new Error('Chýba D1 migrácia Trinity/migrations/0057_audit_logs_ledger.sql');
  }
  if (!fs.existsSync(bridgePath)) {
    throw new Error('Chýba Desktop Commander most scripts/desktop-commander-bridge/bridge.js');
  }

  const config = parseJsonc(fs.readFileSync(trinityWranglerPath, 'utf8'));
  const prod = config.env?.production;
  const staging = config.env?.staging;

  if (!prod || !staging) {
    throw new Error('wrangler.jsonc musí obsahovať env.production aj env.staging');
  }

  if (prod.vars?.ENVIRONMENT !== 'production' || prod.vars?.STRICT_MODE !== 'true') {
    throw new Error('env.production musí mať ENVIRONMENT="production" a STRICT_MODE="true"');
  }
  if (staging.vars?.ENVIRONMENT !== 'staging' || staging.vars?.STRICT_MODE !== 'false') {
    throw new Error('env.staging musí mať ENVIRONMENT="staging" a STRICT_MODE="false"');
  }

  const prodDb = prod.d1_databases?.find((d) => d.binding === 'DB')?.database_name;
  const stagingDb = staging.d1_databases?.find((d) => d.binding === 'DB')?.database_name;
  if (prodDb !== 'trinity-v03' || stagingDb !== 'trinity-development') {
    throw new Error(`Neplatná D1 izolácia: prod=${prodDb}, staging=${stagingDb}`);
  }

  const requiredServices = ['PROFILE_SERVICE', 'CORE_SERVICE', 'DISPATCHER_SERVICE', 'AI_INFERENCE_SERVICE'];
  for (const binding of requiredServices) {
    if (!prod.services?.some((s) => s.binding === binding)) {
      throw new Error(`env.production postráda servisnú väzbu ${binding}`);
    }
    if (!staging.services?.some((s) => s.binding === binding)) {
      throw new Error(`env.staging postráda servisnú väzbu ${binding}`);
    }
  }

  execFileSync(process.execPath, [path.join(rootDir, 'Trinity', 'scripts', 'cloudflare-env-audit.mjs'), '--strict'], {
    cwd: rootDir,
    stdio: 'pipe'
  });

  return {
    ok: true,
    checked_at: new Date().toISOString(),
    production_d1: prodDb,
    staging_d1: stagingDb,
    service_bindings_verified: requiredServices
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPreDeployCheck();
  console.log(JSON.stringify(result, null, 2));
}

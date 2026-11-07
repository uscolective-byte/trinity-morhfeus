#!/usr/bin/env node
/**
 * Syntax/bundle matrix for the same canonical targets used by deployment.
 * Wrangler dry-run remains the release-level check for bindings and config.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { WORKER_DEPLOYMENTS } from './lib/worker-deployments.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRINITY_ESBUILD = path.join(ROOT_DIR, 'Trinity/node_modules/esbuild/lib/main.js');
let build;
try {
  ({ build } = await import(pathToFileURL(TRINITY_ESBUILD).href));
} catch {
  ({ build } = await import('esbuild'));
}

function mainFromConfig(configPath) {
  const source = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
  const match = configPath.endsWith('.toml')
    ? source.match(/^\s*main\s*=\s*["']([^"']+)["']/m)
    : source.match(/"main"\s*:\s*"([^"]+)"/);
  return match?.[1] || null;
}

console.log(`CANONICAL WORKER ENTRYPOINT MATRIX (${WORKER_DEPLOYMENTS.length} targets)`);
const results = [];

for (const target of WORKER_DEPLOYMENTS) {
  const configPath = path.resolve(ROOT_DIR, target.dir, target.config);
  if (!fs.existsSync(configPath)) {
    results.push({ worker: target.name, status: 'CONFIG_MISSING' });
    continue;
  }

  const main = mainFromConfig(configPath);
  if (!main) {
    results.push({ worker: target.name, status: 'MAIN_MISSING' });
    continue;
  }

  const entry = path.resolve(path.dirname(configPath), main);
  if (!fs.existsSync(entry)) {
    results.push({ worker: target.name, status: 'ENTRY_MISSING', entry: path.relative(ROOT_DIR, entry) });
    continue;
  }

  try {
    await build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      platform: 'neutral',
      target: 'es2022',
      format: 'esm',
      packages: 'external',
      loader: { '.html': 'text', '.css': 'text', '.webp': 'binary', '.sql': 'text' }
    });
    results.push({ worker: target.name, status: 'ENTRY_BUILD_OK' });
  } catch (error) {
    const message = (error.message || 'unknown error').split('\n').slice(0, 3).join(' | ');
    results.push({ worker: target.name, status: 'ENTRY_BUILD_FAIL', error: message });
  }
}

console.table(results);
const failed = results.filter(result => result.status !== 'ENTRY_BUILD_OK');
console.log(`Summary: ${results.length - failed.length}/${results.length} entrypoints passed; ${failed.length} failed.`);
if (failed.length) process.exit(1);

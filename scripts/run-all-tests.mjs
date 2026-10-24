#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SUITES = [
  { name: 'Trinity Main Fleet', dir: resolve(ROOT, 'Trinity'), cmd: 'npm', args: ['test'] },
  { name: 'Audit-Worker', dir: resolve(ROOT, 'Audit-Worker'), cmd: 'npm', args: ['test'] },
  { name: 'Capacity-Worker', dir: resolve(ROOT, 'Capacity-Worker'), cmd: 'npm', args: ['test'] }
];

console.log('🧪 RUNNING ALL SUITES...');
for (const s of SUITES) {
  console.log(`\n▶ [${s.name}] in ${s.dir}...`);
  const res = spawnSync(s.cmd, s.args, {
    cwd: s.dir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }
  });
  if (res.status !== 0) {
    console.error(`❌ Suite failed: ${s.name} (exit code ${res.status})`);
    process.exit(res.status || 1);
  }
  console.log(`✅ Passed: ${s.name}`);
}

console.log('\n🎉 ALL SUITES PASSED CLEANLY!');

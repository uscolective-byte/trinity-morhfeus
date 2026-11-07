// Root CLI compatibility only. Canonical releases use Trinity/wrangler.jsonc.
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = JSON.parse(readFileSync(resolve(root, 'Trinity/wrangler.jsonc'), 'utf8').replace(/^\uFEFF/, ''));
if (canonical.main !== 'src/index.js') throw new Error('Canonical entry changed; review root compatibility paths first.');
if (canonical.migrations || !canonical.exports?.TrinityAgent || !canonical.exports?.ChatAgent || !canonical.exports?.GuardianAgent)
  throw new Error('Expected canonical declarative Durable Object exports. No implicit lifecycle conversion is permitted.');
const mirror = structuredClone(canonical);
mirror.$schema = 'Trinity/node_modules/wrangler/config-schema.json';
mirror.main = 'src/index.ts';
function rebase(value) {
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'migrations_dir')) {
    if (value.migrations_dir !== 'migrations') throw new Error('Unexpected migrations path; refusing a blind rewrite.');
    value.migrations_dir = 'Trinity/migrations';
  }
  for (const nested of Object.values(value)) rebase(nested);
}
rebase(mirror);
const output = JSON.stringify(mirror, null, 2) + '\n';
const target = resolve(root, 'wrangler.jsonc');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n') !== output) {
    console.error('Root Wrangler configuration differs from the canonical project. Run node scripts/sync-root-wrangler.mjs.');
    process.exitCode = 1;
  } else console.log('Root Wrangler configuration matches canonical metadata and rebased paths.');
} else {
  writeFileSync(target, output, 'utf8');
  console.log('Root Wrangler configuration synchronized. No cloud resources or secrets changed.');
}

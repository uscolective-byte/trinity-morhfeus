import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {diagnoseAccess} from './lib/cloudflare-access.mjs';

const args = process.argv.slice(2);
let origin = 'https://auru.space', output;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--origin' && args[i + 1]) origin = args[++i];
  else if (args[i] === '--output' && args[i + 1]) output = args[++i];
  else if (args[i] !== '--mcp') throw new Error('Usage: node scripts/check-trinity-access.mjs [--origin https://auru.space|https://auru.dev] [--mcp] [--output FILE]');
}
try {
  const config = JSON.parse(readFileSync(fileURLToPath(new URL('../Trinity/wrangler.jsonc', import.meta.url)), 'utf8'));
  const report = await diagnoseAccess({origin, env: process.env,
    accountId: config.account_id,
    appId: process.env.TRINITY_ACCESS_APP_ID || (origin.replace(/\/$/, '') === 'https://auru.space' ? '018042bf-984f-4cf6-bf68-cbb760d9a6da' : undefined),
    includeMcp: args.includes('--mcp')});
  const json = JSON.stringify(report, null, 2) + '\n';
  if (output) writeFileSync(output, json, {flag: 'wx', mode: 0o600});
  process.stdout.write(json);
  if (!report.access_verified || !report.application_ready || (args.includes('--mcp') && !report.mcp?.verified)) process.exitCode = 2;
} catch {
  console.error('Access diagnostic failed. No credentials or raw upstream errors were printed.');
  process.exitCode = 1;
}

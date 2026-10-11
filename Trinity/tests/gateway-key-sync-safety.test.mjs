import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Windows key sync fixes account and Worker, uses stdin, sanitizes logs and never uploads project code', () => {
  const source = readFileSync(new URL('../scripts/sync-gateway-key.ps1', import.meta.url), 'utf8');
  assert.ok(source.includes("name = 'trinity'"));
  assert.ok(source.includes("'b60342e5e52f5646fbd4e913bb409334'"));
  assert.ok(source.includes("['CLOUDFLARE_API_BASE_URL'] = 'https://api.cloudflare.com/client/v4'"));
  assert.ok(source.includes("['WRANGLER_LOG_SANITIZE'] = 'true'"));
  assert.ok(source.includes("['WRANGLER_LOG'] = 'log'"));
  assert.ok(source.includes('[string]::IsNullOrWhiteSpace($check.Output)'));
  assert.ok(source.includes('$process.StandardInput.WriteLine($SecretInput)'));
  assert.ok(source.includes("'secret list ' + $flags"));
  assert.equal((source.match(/'secret put TRINITY_GATEWAY_KEY '/g) || []).length, 1);
  assert.ok(source.includes('ZeroFreeBSTR($pointer)'));
  assert.ok(source.includes('if (-not $uploaded) { exit 1 }'));
  assert.doesNotMatch(source, /Write-(?:Host|Output)\s+\$key\b|Set-Content[^\n]*\$key\b/);
  assert.doesNotMatch(source, /npx|npm (?:install|ci)|wrangler (?:deploy|versions upload|versions deploy)|--force/);
});

test('Wrangler metadata logger is not filtered out by the sync helper', () => {
  const source = readFileSync(new URL('../scripts/sync-gateway-key.ps1', import.meta.url), 'utf8');
  const cli = readFileSync(new URL('../node_modules/wrangler/wrangler-dist/cli.js', import.meta.url), 'utf8');
  const levelsBlock = cli.match(/LOGGER_LEVELS = \{([^}]+)\}/)?.[1];
  assert.ok(levelsBlock, 'Find installed Wrangler logging levels without running its auth code');
  const levels = Object.fromEntries([...levelsBlock.matchAll(/(\w+):\s*(-?\d+)/g)].map(m => [m[1], Number(m[2])]));
  const configured = source.match(/\['WRANGLER_LOG'\] = '([^']+)'/)?.[1];
  assert.ok(levels[configured] >= levels.log, 'Secret-list JSON at log level remains visible');
  assert.ok(levels[configured] < levels.debug, 'Do not enable request debug logging');
});
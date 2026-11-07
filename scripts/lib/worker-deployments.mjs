/**
 * Canonical source-of-truth for Trinity's deployable Worker targets.
 * Covers all 46 canonical Cloudflare workers + Worker #47 (trinity-profile),
 * totaling 47 targets across AURA, Core, Standalone, and Auxiliary fleets.
 */

export const AURA_WORKERS = [
  'aura_analyzer', 'aura_architect', 'aura_codegen', 'aura_deployer', 'aura_evolver',
  'aura_memory', 'aura_optimizer', 'aura_planner', 'aura_sentinel', 'aura_tester'
];

export const TRINITY_CORE_WORKERS = [
  'trinity-core', 'trinity-builder', 'trinity-dispatcher', 'trinity-connectors',
  'trinity-guardian', 'trinity-memory', 'trinity-sentinel', 'trinity-skills'
];

export const STANDALONE_WORKERS = [
  { name: 'trinity-capacity', dir: 'Capacity-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-knowledge', dir: 'Knowledge-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-integrations', dir: 'Integrations-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-pc-bridge', dir: 'PC-Bridge-Worker', config: 'wrangler.jsonc' },
  { name: 'trinity-audit', dir: 'Audit-Worker', config: 'wrangler.jsonc' },
  { name: 'jericho123', dir: 'Jericho-Worker', config: 'wrangler.jsonc' }
];

export const AUXILIARY_WORKERS = [
  { name: 'trinity-chat-inference', dir: 'Trinity', config: 'wrangler.chat.jsonc' },
  { name: 'trinity-ops', dir: 'Trinity', config: 'wrangler.ops.jsonc' },
  { name: 'trinity-staging', dir: '.', config: 'wrangler.jsonc', env: 'staging' },
  // Frontends, App Templates, and Extended Utility Workers:
  { name: 'chanfana-openapi-template', dir: 'chanfana-openapi-template', config: 'wrangler.toml' },
  { name: 'muddy-wind-42e2', dir: 'muddy-wind-42e2', config: 'wrangler.toml' },
  { name: 'my-react-app', dir: 'my-react-app', config: 'wrangler.toml' },
  { name: 'noisy-hat-011e', dir: 'noisy-hat-011e', config: 'wrangler.toml' },
  { name: 'react-router-starter-templates', dir: 'react-router-starter-templates', config: 'wrangler.toml' },
  { name: 'saas-admin-template', dir: 'saas-admin-template', config: 'wrangler.toml' },
  { name: 'small-pine-596d', dir: 'small-pine-596d', config: 'wrangler.toml' },
  { name: 'snowy-fire-3605', dir: 'snowy-fire-3605', config: 'wrangler.toml' },
  { name: 'vite-react-template', dir: 'vite-react-template', config: 'wrangler.toml' },
  { name: 'vite-react-templates', dir: 'vite-react-templates', config: 'wrangler.toml' },
  { name: 'trinity-agent-researcher', dir: 'trinity-agent-researcher', config: 'wrangler.toml' },
  { name: 'trinity-chat-maintainer', dir: 'trinity-chat-maintainer', config: 'wrangler.toml' },
  { name: 'trinity-deployer', dir: 'trinity-deployer', config: 'wrangler.toml' },
  { name: 'trinity-gemini', dir: 'trinity-gemini', config: 'wrangler.toml' },
  { name: 'trinity-morhfeus', dir: 'trinity-morhfeus', config: 'wrangler.toml' },
  { name: 'trinity-pc-bridge-v2', dir: 'trinity-pc-bridge-v2', config: 'wrangler.toml' },
  { name: 'trinity-seeder', dir: 'trinity-seeder', config: 'wrangler.toml' },
  { name: 'trinityguardiantruthverifierworker', dir: 'trinityguardiantruthverifierworker', config: 'wrangler.toml' }
];

export const PROFILE_WORKER = { name: 'trinity-profile', dir: 'trinity-profile', config: 'wrangler.toml' };
export const MASTER_WORKER = { name: 'trinity', dir: '.', config: 'wrangler.jsonc' };

export const WORKER_DEPLOYMENTS = [
  ...AURA_WORKERS.map(name => ({
    name,
    dir: 'Trinity',
    config: `workers/aura/${name}.jsonc`
  })),
  ...TRINITY_CORE_WORKERS.map(name => ({
    name,
    dir: 'Trinity',
    config: `workers/trinity/${name}.jsonc`
  })),
  ...STANDALONE_WORKERS,
  ...AUXILIARY_WORKERS,
  PROFILE_WORKER,
  MASTER_WORKER
];

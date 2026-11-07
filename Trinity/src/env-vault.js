/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CONFIG_AND_ENV_VAULT
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Zjednotený správca konfigurácie, premenných prostredia a tajomstiev pre TRINITY OMNI-CORE.
 * Umožňuje bezpečné čítanie kľúčov v poradí:
 * 1. Cloudflare Secrets Store / Worker env bindings (produkcia/staging)
 * 2. D1 SQL Trezor tajomstiev (ops_secret_vault)
 * 3. Lokálne premenné prostredia (.env / process.env) pri lokálnom vývoji
 */

import { readTrinityMasterSecret } from './trinity-master-secrets.js';
import { sanitizeApiKey } from './ai-providers.js';

export const PROVIDER_ENV_KEYS = Object.freeze({
  gemini: ['GEMINI_API_KEY', 'apigoogle'],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  groq: ['GROQ_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  cloudflare: ['CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN', 'TRINITY_CF_TOKEN'],
  github: ['GITHUB_TOKEN', 'TRINITY_GITHUB_TOKEN', 'GITHUBE_API_KEY'],
  firecrawl: ['FIRECRAWL_API_KEY', 'TRINITY_FIRECRAWL_KEY'],
  firebase: ['FIREBASE_API_KEY', 'FIREBASE_SERVICE_ACCOUNT'],
  azure: ['AZURE_AI_FOUNDRY_TOKEN', 'Azureagent_api', 'AZURE_BEARER_TOKEN'],
  r2: ['R2_SECRET_ACCESS_KEY'],
  ollama: ['OLLAMA_SECRET', 'OLLAMA_API_KEY']
});

/**
 * Získa hodnotu tajomstva pre daného poskytovateľa z najvyššej dostupnej vrstvy.
 * @param {object} env - Cloudflare Worker env alebo globálny kontext
 * @param {string} provider - Názov poskytovateľa (gemini, openai, cloudflare, atď.)
 * @returns {Promise<string|null>} Hodnota kľúča alebo null
 */
export async function getProviderSecret(env = {}, provider) {
  const normProvider = String(provider || '').toLowerCase().trim();

  // 1. Priorita: Cloudflare Secrets Store (asynchrónny .get())
  const masterSecret = await readTrinityMasterSecret(env, normProvider);
  if (masterSecret) return masterSecret;

  // 2. Priorita: Worker env bindings / process.env
  const keyNames = PROVIDER_ENV_KEYS[normProvider] || [];
  for (const key of keyNames) {
    const val = env[key] || (typeof process !== 'undefined' ? process.env?.[key] : null);
    if (val) {
      if (typeof val.get === 'function') {
        try {
          const res = await val.get();
          if (typeof res === 'string' && res.trim()) return res.trim();
        } catch {}
      } else if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  }

  // 3. Priorita: D1 SQL ops_secret_vault (šifrovaný trezor)
  if (env?.DB?.prepare && typeof env.TRINITY_VAULT_KEY === 'string') {
    try {
      const row = await env.DB.prepare(
        "SELECT * FROM ops_secret_vault WHERE provider=? AND status!='revoked' ORDER BY CASE WHEN status='verified' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1"
      ).bind(normProvider).first();

      if (row) {
        // Dynamický import pre predídenie cyklickým závislostiam
        const { getSecretMaterial } = await import('./secret-vault.js');
        const mat = await getSecretMaterial(env, { ownerId: row.owner_id, id: row.id, provider: normProvider });
        if (mat?.secret) return mat.secret;
      }
    } catch {}
  }

  return null;
}

/**
 * Získa kompletný prehľad o stave všetkých poskytovateľov v prostredí bez vyzradenia tajomstiev.
 */
export function getEnvironmentOverview(env = {}) {
  const providers = {};
  for (const [provider, keys] of Object.entries(PROVIDER_ENV_KEYS)) {
    let configured = false;
    let source = 'not_configured';

    for (const key of keys) {
      const val = env[key] || (typeof process !== 'undefined' ? process.env?.[key] : null);
      if (val) {
        configured = true;
        source = typeof val.get === 'function' ? 'secrets_store' : 'environment_variable';
        break;
      }
    }

    providers[provider] = {
      configured,
      source
    };
  }

  return {
    environment: env.TRINITY_ENV || (typeof process !== 'undefined' ? process.env?.NODE_ENV : 'unknown'),
    providers
  };
}

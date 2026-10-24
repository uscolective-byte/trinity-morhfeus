// Credentials stay in Worker bindings. Only explicit provider aliases are resolved.
export const SECRET_ALIASES = Object.freeze({
  GEMINI_API_KEY: ['GOOGLE_GEMINI_API_KEY', 'GOOGLE_AI_API_KEY'],
  OPENAI_API_KEY: ['OPENAI_KEY'],
  ANTHROPIC_API_KEY: ['CLAUDE_API_KEY'],
  CF_API_TOKEN: ['CLOUDFLARE_API_TOKEN'],
  GITHUB_TOKEN: ['GH_TOKEN', 'GITHUB_API_TOKEN'],
  FIRECRAWL_API_KEY: ['FIRECRAWL_KEY'],
  OLLAMA_API_KEY: ['OLLAMA_SECRET'],
  GROQ_API_KEY: [], DEEPSEEK_API_KEY: [], MISTRAL_API_KEY: [], OPENROUTER_API_KEY: [],
  GOOGLE_CLIENT_SECRET: [], COPILOT_STUDIO_SECRET: [], AURA_SERVICE_TOKEN: [],
  TRINITY_GATEWAY_KEY: [], TELEGRAM_BOT_TOKEN: [], PAYPAL_CLIENT_SECRET: []
});

export async function resolveRuntimeSecrets(env) {
  const resolved = {...env};
  const unavailable = [];
  for (const [canonical, aliases] of Object.entries(SECRET_ALIASES)) {
    for (const name of [canonical, ...aliases]) {
      const binding = env[name];
      // A failed canonical binding must not silently pick another account's key.
      if (binding == null || binding === '') continue;
      try {
        const value = typeof binding === 'string' ? binding : typeof binding?.get === 'function' ? await binding.get() : null;
        if (typeof value !== 'string' || !value.trim()) throw new Error('unavailable');
        resolved[canonical] = value;
      } catch {
        resolved[canonical] = undefined;
        unavailable.push(canonical);
      }
      break;
    }
  }
  resolved.TRINITY_UNAVAILABLE_SECRET_BINDINGS = unavailable;
  return resolved;
}

export function runtimeSecretStatus(env) {
  const supported = new Set(Object.entries(SECRET_ALIASES).flatMap(([key, aliases])=>[key,...aliases]));
  return {
    bindings: Object.entries(SECRET_ALIASES).map(([name, aliases])=>({
      name, status: env.TRINITY_UNAVAILABLE_SECRET_BINDINGS?.includes(name) ? 'unavailable' : [name,...aliases].some(key=>Boolean(env[key])) ? 'configured' : 'missing',
      verified: false
    })),
    unmapped_names: Object.keys(env).filter(name=>/^[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|GATEWAY_KEY)$/.test(name)&&!supported.has(name)),
    note: 'Konfigurácia nepotvrdzuje platnosť kľúča ani vykonanie operácie. Hodnoty secrets sa nevracajú.'
  };
}

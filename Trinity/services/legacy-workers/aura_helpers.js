// Shared Aura Worker helpers. Service protocol version is distinct from Trinity app release.
export const AURA_SERVICE_VERSION='2.1.0';

export function getAiModel(env, preferred) {
  if (preferred && env[preferred]) return env[preferred];
  return env.AI_MODEL || '@cf/openai/gpt-oss-120b';
}

export async function runAuraAi(env, systemPrompt, userPrompt, options = {}) {
  if (!env?.AI?.run) {
    throw new Error('AI binding nie je dostupné.');
  }
  const model = options.model || getAiModel(env);
  const fallbackModel = options.fallbackModel || '@cf/meta/llama-3.1-8b-instruct';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const res = await env.AI.run(model, { messages, ...options.params });
    const text = typeof res?.response === 'string' ? res.response : (res?.text || JSON.stringify(res));
    return text || '';
  } catch (primaryErr) {
    if (model !== fallbackModel) {
      try {
        const fallbackRes = await env.AI.run(fallbackModel, { messages });
        return typeof fallbackRes?.response === 'string' ? fallbackRes.response : (fallbackRes?.text || '');
      } catch (fallbackErr) {
        throw new Error(`AI volanie zlyhalo (${model}: ${primaryErr.message}; ${fallbackModel}: ${fallbackErr.message})`);
      }
    }
    throw primaryErr;
  }
}

export function parseAuraJson(text) {
  if (!text || typeof text !== 'string') return { raw: text || '' };
  const trimmed = text.trim();
  
  // 1. Priamy JSON parse
  try { return JSON.parse(trimmed); } catch {}

  // 2. Odstránenie markdown ```json ... ``` obalu
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try { return JSON.parse(stripped); } catch {}

  // 3. Extrakcia prvého vyváženého JSON objektu alebo poľa
  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }

  // 4. Fallback na raw odpoveď
  return { raw: text };
}

export async function safeDbRun(promise) {
  try {
    return await promise;
  } catch (err) {
    // Tichý fallback ak tabuľka chýba alebo má odlišnú schému v D1
    return null;
  }
}


// Mutations must surface D1 failures instead of fabricating a successful write.
export async function safeDbWrite(promise) {
  const result=await promise;
  if(!result||result.success!==true)throw new Error('D1 write did not succeed');
  return result;
}

// AURA Workers Helpers — zdieľaná logika pre inteligentné modely a robustný JSON parsing (Trinity 10.3)

export function getAiModel(env, preferred) {
  if (preferred && env[preferred]) return env[preferred];
  return env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
}

export async function runAuraAi(env, systemPrompt, userPrompt, options = {}) {
  // 1. Check CHAT_INFERENCE_SERVICE binding if available
  if (env?.CHAT_INFERENCE_SERVICE && typeof env.CHAT_INFERENCE_SERVICE.fetch === 'function') {
    try {
      const resp = await env.CHAT_INFERENCE_SERVICE.fetch('https://chat-inference.internal/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          traceId: crypto.randomUUID()
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = typeof data?.response === 'string' ? data.response : (data?.text || (typeof data === 'string' ? data : ''));
        if (text) return text;
      }
    } catch {}
  }

  if (!env?.AI?.run) {
    throw new Error('AI binding nie je dostupné.');
  }

  const model = options.model || getAiModel(env);
  const secondaryModel = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';
  const rapidModel = options.fallbackModel || '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const res = await env.AI.run(model, { messages, ...options.params });
    const text = typeof res?.response === 'string' ? res.response : (res?.text || JSON.stringify(res));
    if (text) return text;
  } catch (primaryErr) {
    try {
      const secRes = await env.AI.run(secondaryModel, { messages });
      const secText = typeof secRes?.response === 'string' ? secRes.response : (secRes?.text || '');
      if (secText) return secText;
    } catch {
      try {
        const fallbackRes = await env.AI.run(rapidModel, { messages });
        return typeof fallbackRes?.response === 'string' ? fallbackRes.response : (fallbackRes?.text || '');
      } catch (fallbackErr) {
        throw new Error(`AI volanie zlyhalo (${model}: ${primaryErr.message}; ${rapidModel}: ${fallbackErr.message})`);
      }
    }
  }
  return '';
}

export function parseAuraJson(text) {
  if (!text || typeof text !== 'string') return { raw: text || '' };
  const trimmed = text.trim();
  
  // 1. Priamy JSON parse
  try { return JSON.parse(trimmed); } catch {}

  // 2. Odstránenie markdown ```json ... ``` obalu
  let stripped = trimmed
    .replace(/^\`\`\`(?:json)?\s*/i, '')
    .replace(/\s*\`\`\`$/i, '')
    .trim();
  try { return JSON.parse(stripped); } catch {}

  // 3. Extrakcia prvého vyváženého JSON objektu alebo poľa
  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    let candidate = match[1];
    try { return JSON.parse(candidate); } catch {}
    // Pokus o odstránenie trailing commas
    candidate = candidate.replace(/,\s*([\}\]])/g, '$1');
    try { return JSON.parse(candidate); } catch {}
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

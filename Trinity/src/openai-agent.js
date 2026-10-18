// OpenAI Responses API adapter for Trinity.
// OPENAI_API_KEY must be provided as a Cloudflare Worker secret.

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5";

export function openAIConfigured(env = {}) {
  return Boolean(env.OPENAI_API_KEY);
}

export async function askOpenAI(env = {}, input, options = {}) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured. Add it as a Cloudflare Worker secret.");
  }

  const prompt = typeof input === "string" ? input.trim() : "";
  if (!prompt) throw new Error("OpenAI input must be a non-empty string.");

  const body = {
    model: options.model || env.OPENAI_MODEL || DEFAULT_MODEL,
    instructions:
      options.instructions ||
      "You are Trinity's development assistant. Help develop, debug and improve Trinity. Prefer safe, reviewable changes and never reveal secrets.",
    input: prompt,
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`OpenAI returned a non-JSON response (${response.status}).`);
  }

  if (!response.ok) {
    const message = data?.error?.message || `OpenAI request failed (${response.status}).`;
    throw new Error(message);
  }

  const text = extractOpenAIText(data);
  return { text, model: data.model || body.model, id: data.id || null, raw: data };
}

export function extractOpenAIText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if ((content?.type === "output_text" || content?.type === "text") && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n");
}

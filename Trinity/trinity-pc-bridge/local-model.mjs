// Local inference only. No caller-selected URL, shell, cloud fallback or API key.
export const LOCAL_MODEL_PROFILE = Object.freeze({
  model: 'qwen3:4b-instruct',
  endpoint: 'http://127.0.0.1:11434/api/chat',
  threads: 6,
  context: 4096,
  maxOutputTokens: 600,
  keepAlive: '30m',
  // Stay below the cloud action's 90-second claim lease.
  timeoutMs: 75_000,
});

async function readJson(response) {
  if (!response.body) throw new Error('Ollama vratila prazdnu odpoved.');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 128_000) {
        await reader.cancel();
        throw new Error('Odpoved Ollama prekrocila povolenu velkost.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Ollama nevratila platnu JSON odpoved.');
  }
}

export async function runLocalInference(payload, {fetchImpl = globalThis.fetch} = {}) {
  if (payload?.task !== 'local-inference' || !Array.isArray(payload.messages)
      || payload.messages.length < 1 || payload.messages.length > 20) {
    throw new Error('Neplatna poziadavka na lokalny model.');
  }
  let totalBytes = 0;
  const messages = payload.messages.map(message => {
    if (!['system', 'user', 'assistant'].includes(message?.role)
        || typeof message.content !== 'string'
        || !message.content.trim() || message.content.length > 20_000) {
      throw new Error('Neplatna sprava pre lokalny model.');
    }
    totalBytes += Buffer.byteLength(message.content);
    return {role: message.role, content: message.content};
  });
  if (totalBytes > 100_000) throw new Error('Spravy pre lokalny model su prilis velke.');
  const requested = Number(payload.max_tokens);
  const maxTokens = Number.isFinite(requested)
    ? Math.max(32, Math.min(Math.floor(requested), LOCAL_MODEL_PROFILE.maxOutputTokens))
    : 320;
  let response, data;
  try {
    response = await fetchImpl(LOCAL_MODEL_PROFILE.endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      redirect: 'error',
      signal: AbortSignal.timeout(LOCAL_MODEL_PROFILE.timeoutMs),
      body: JSON.stringify({
        model: LOCAL_MODEL_PROFILE.model,
        messages,
        stream: false,
        keep_alive: LOCAL_MODEL_PROFILE.keepAlive,
        options: {
          num_predict: maxTokens,
          num_ctx: LOCAL_MODEL_PROFILE.context,
          num_thread: LOCAL_MODEL_PROFILE.threads,
          temperature: 0.25,
        },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) {
        throw new Error('Model qwen3:4b-instruct chyba. Spusti: ollama pull qwen3:4b-instruct');
      }
      throw new Error(`Lokalna Ollama vratila HTTP ${response.status}.`);
    }
    data = await readJson(response);
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('Lokalny model neodpovedal do 75 sekund. Over Ollama a nacitaj model pred dalsim pokusom.');
    }
    if (error instanceof TypeError) {
      throw new Error('Ollama na 127.0.0.1:11434 nie je dostupna. Spusti aplikaciu Ollama.');
    }
    throw error;
  }
  if (data?.error || data?.done !== true || data?.model !== LOCAL_MODEL_PROFILE.model
      || data?.message?.role !== 'assistant'
      || typeof data.message.content !== 'string' || !data.message.content.trim()) {
    throw new Error('Ollama nepotvrdila dokoncenu odpoved nakonfigurovaneho modelu.');
  }
  const usage = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return {
    action: 'read',
    task: 'local-inference',
    model: data.model,
    response: data.message.content,
    usage: {input: usage(data.prompt_eval_count), output: usage(data.eval_count)},
    completed: true,
  };
}
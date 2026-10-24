import { HttpError } from './security.js';
import { queryGraphContext } from './graph-memory.js';
import { callModel } from './services.js';

export async function handleVoiceDialogue(env, user, { audioBytes, audioMime = 'audio/webm', textPrompt = '' } = {}) {
  let userQuery = (textPrompt || '').trim();

  // 1. Ak prišlo audio, prepíšeme ho cez Cloudflare Whisper Large v3 Turbo
  if (audioBytes && audioBytes.length > 0 && env.AI) {
    try {
      const sttModel = env.STT_MODEL || '@cf/openai/whisper-large-v3-turbo';
      const sttResult = await env.AI.run(sttModel, {
        audio: [...new Uint8Array(audioBytes)]
      });
      if (sttResult && (sttResult.text || sttResult.vtt)) {
        userQuery = (sttResult.text || sttResult.vtt).trim();
      }
    } catch (sttErr) {
      if (!userQuery) {
        throw new HttpError(502, `Hlasový prepis zlyhal: ${sttErr.message}`);
      }
    }
  }

  if (!userQuery) {
    throw new HttpError(400, 'Nebol poskytnutý žiadny hlasový ani textový vstup.');
  }

  // 2. Kontextové obohatenie pamäťovým grafom (Graph RAG)
  let graphContext = { matched_nodes: [], relationships: [] };
  try {
    graphContext = await queryGraphContext(env, userQuery, 2, 5);
  } catch {}

  const graphSummary = graphContext.matched_nodes.length > 0
    ? `\nSúvislosti z pamäťového grafu:\n` + graphContext.matched_nodes.map(n => `- ${n.type.toUpperCase()}: ${n.label}`).join('\n')
    : '';

  // 3. Generovanie odpovede cez Trinity AI
  const systemPrompt = `Si osobná asistentka Trinity pre používateľa Ivana Saba (Basterix). Hovoríš cez handsfree hlasové rozhranie. Odpovedaj prirodzene, stručne a výstižne (1-3 vety vhodné na počúvanie), po slovensky. Nepoužívaj zložité tabuľky ani markdown odrážky, ktoré sa zle čítajú nahlas.${graphSummary}`;

  let replyText = 'Rozumiem, požiadavka bola prijatá.';
  try {
    const aiResp = await callModel(env, 'auto', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery }
    ], 300);
    replyText = (aiResp.text || replyText).trim();
  } catch {
    replyText = `Počula som: "${userQuery}". Momentálne spracovávam akciu.`;
  }

  // 4. Syntéza hlasu (TTS) cez MeloTTS alebo návrat textu pre browser SpeechSynthesis
  let audioBase64 = null;
  if (env.AI && env.TTS_MODEL) {
    try {
      const ttsResult = await env.AI.run(env.TTS_MODEL, { text: replyText });
      if (ttsResult instanceof ReadableStream || ttsResult instanceof ArrayBuffer || Array.isArray(ttsResult)) {
        const buffer = ttsResult instanceof ArrayBuffer ? ttsResult : await new Response(ttsResult).arrayBuffer();
        audioBase64 = `data:audio/wav;base64,${Buffer.from(buffer).toString('base64')}`;
      }
    } catch {}
  }

  // 5. Zápis do ops_events
  if (env.DB) {
    await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('voice_dialogue_turn', ?)")
      .bind(JSON.stringify({ query: userQuery, user: user?.email || 'admin', has_audio: Boolean(audioBase64) }))
      .run().catch(() => {});
  }

  return {
    transcript: userQuery,
    reply: replyText,
    audio_data_url: audioBase64,
    graph_context: graphContext,
    at: new Date().toISOString()
  };
}

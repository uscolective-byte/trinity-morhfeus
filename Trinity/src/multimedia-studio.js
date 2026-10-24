import { z } from 'zod';
import { createArtifact, createPdfArtifact } from './artifacts.js';
import { recordStepDocument } from './trinity-documents.js';

export const MUSIC_GENRES = ['synthwave', 'ambient', 'cinematic', 'lofi', 'techno', 'orchestral'];
export const VIDEO_STYLES = ['cyberpunk', 'cinematic', 'business', 'space', 'nature', 'abstract'];
export const PRESENTATION_THEMES = ['midnight-tech', 'cyber-gold', 'emerald-growth', 'clean-light', 'royal-violet'];
export const PHOTO_STYLES = ['photorealistic', 'cinematic', 'cyberpunk', 'portrait', 'product', 'logo', 'digital-art', 'poster'];
export const CREATIVE_PACK_TYPES = ['infographic', 'social_pack', 'storyboard', 'brand_kit'];

export const generateMusicSchema = z.object({
  prompt: z.string().trim().min(2).max(1500),
  title: z.string().trim().max(140).optional(),
  genre: z.enum(MUSIC_GENRES).optional().default('synthwave'),
  bpm: z.number().int().min(60).max(160).optional(),
  duration_sec: z.number().int().min(4).max(24).optional().default(8)
}).strict();

export const generateVideoSchema = z.object({
  prompt: z.string().trim().min(2).max(2000),
  title: z.string().trim().max(140).optional(),
  style: z.enum(VIDEO_STYLES).optional().default('cinematic'),
  duration_sec: z.number().int().min(8).max(60).optional().default(16),
  scenes_count: z.number().int().min(3).max(8).optional().default(4)
}).strict();

export const generatePresentationSchema = z.object({
  topic: z.string().trim().min(2).max(2000),
  title: z.string().trim().max(160).optional(),
  subtitle: z.string().trim().max(300).optional(),
  audience: z.string().trim().max(160).optional().default('Klienti, investori a tím'),
  theme: z.enum(PRESENTATION_THEMES).optional().default('midnight-tech'),
  slides_count: z.number().int().min(4).max(10).optional().default(6),
  key_points: z.array(z.string().trim().max(300)).max(10).optional().default([])
}).strict();

export const generateCreativePackSchema = z.object({
  prompt: z.string().trim().min(2).max(2000),
  title: z.string().trim().max(160).optional(),
  pack_type: z.enum(CREATIVE_PACK_TYPES).optional().default('infographic'),
  theme: z.enum(PRESENTATION_THEMES).optional().default('midnight-tech')
}).strict();

export const generatePhotoStudioSchema = z.object({
  prompt: z.string().trim().min(2).max(2000),
  title: z.string().trim().max(140).optional(),
  style: z.enum(PHOTO_STYLES).optional().default('photorealistic'),
  aspect_ratio: z.enum(['1:1', '16:9', '9:16']).optional().default('16:9'),
  seed: z.number().int().min(1).max(9999999999).optional()
}).strict();

function slugify(text, fallback = 'trinity-media') {
  const s = String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return s || fallback;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function ensureMultimediaSchema(env) {
  if (!env?.DB?.prepare) return;
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ops_multimedia_creations (
        id TEXT PRIMARY KEY,
        media_type TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        style TEXT,
        artifact_id TEXT,
        url TEXT NOT NULL,
        download_url TEXT,
        secondary_url TEXT,
        meta_json TEXT DEFAULT '{}',
        created_by TEXT DEFAULT 'trinity',
        created_at TEXT NOT NULL
      )
    `).run();
  } catch {
    // Table creation fallback
  }
}

async function saveCreationRecord(env, item) {
  await ensureMultimediaSchema(env);
  if (!env?.DB?.prepare) return;
  try {
    await env.DB.prepare(`
      INSERT INTO ops_multimedia_creations(id, media_type, title, prompt, style, artifact_id, url, download_url, secondary_url, meta_json, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id,
      item.media_type,
      item.title,
      item.prompt,
      item.style || '',
      item.artifact_id || null,
      item.url,
      item.download_url || item.url,
      item.secondary_url || null,
      JSON.stringify(item.meta || {}),
      item.created_by || 'trinity',
      item.created_at
    ).run();
  } catch {
    // Non-fatal
  }
}

export async function listMultimediaCreations(env, { media_type = '', limit = 30 } = {}) {
  await ensureMultimediaSchema(env);
  if (!env?.DB?.prepare) return { items: [], counts: { total: 0, photo: 0, video: 0, music: 0, presentation: 0, creative_pack: 0 } };
  const lim = Math.max(1, Math.min(Number(limit) || 30, 100));
  try {
    let q = 'SELECT * FROM ops_multimedia_creations';
    const params = [];
    if (media_type && media_type !== 'all') {
      q += ' WHERE media_type = ?';
      params.push(media_type);
    }
    q += ' ORDER BY created_at DESC LIMIT ?';
    params.push(lim);
    const rows = await env.DB.prepare(q).bind(...params).all();
    const items = (rows.results || []).map(r => {
      let meta = {};
      try { meta = JSON.parse(r.meta_json || '{}'); } catch {}
      return {
        id: r.id,
        media_type: r.media_type,
        title: r.title,
        prompt: r.prompt,
        style: r.style,
        artifact_id: r.artifact_id,
        url: r.url,
        download_url: r.download_url,
        secondary_url: r.secondary_url,
        meta,
        created_by: r.created_by,
        created_at: r.created_at
      };
    });
    const counts = {
      total: items.length,
      photo: items.filter(i => i.media_type === 'photo').length,
      video: items.filter(i => i.media_type === 'video').length,
      music: items.filter(i => i.media_type === 'music').length,
      presentation: items.filter(i => i.media_type === 'presentation').length,
      creative_pack: items.filter(i => i.media_type === 'creative_pack').length
    };
    return { items, counts };
  } catch {
    return { items: [], counts: { total: 0, photo: 0, video: 0, music: 0, presentation: 0, creative_pack: 0 } };
  }
}

// ============================================================================
// 1. REAL POLYPHONIC PCM WAV MUSIC SYNTHESIZER (audio/wav)
// ============================================================================
const GENRE_PRESETS = {
  synthwave: {
    defaultBpm: 108,
    keyName: 'A minor (Synthwave)',
    chords: [
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [130.81, 164.81, 196.0], // C
      [196.0, 246.94, 293.66]  // G
    ],
    melody: [440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0, 523.25],
    bassMult: 0.5,
    drums: true,
    arpSpeed: 4
  },
  ambient: {
    defaultBpm: 72,
    keyName: 'D Dorian (Ambient Space)',
    chords: [
      [146.83, 220.0, 261.63], // Dm7
      [196.0, 246.94, 329.63], // G6
      [174.61, 220.0, 293.66], // Fmaj7
      [164.81, 220.0, 246.94]  // Asus4
    ],
    melody: [293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 349.23, 293.66],
    bassMult: 0.5,
    drums: false,
    arpSpeed: 2
  },
  cinematic: {
    defaultBpm: 92,
    keyName: 'C minor (Epic Cinematic)',
    chords: [
      [130.81, 155.56, 196.0], // Cm
      [207.65, 261.63, 311.13], // Ab
      [155.56, 196.0, 233.08], // Eb
      [196.0, 246.94, 293.66]  // G
    ],
    melody: [261.63, 311.13, 392.0, 415.3, 392.0, 349.23, 311.13, 293.66],
    bassMult: 0.5,
    drums: true,
    arpSpeed: 2
  },
  lofi: {
    defaultBpm: 84,
    keyName: 'F Major 7 (Chill Lo-Fi)',
    chords: [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 164.81, 196.0, 246.94]  // Cmaj7
    ],
    melody: [349.23, 329.63, 293.66, 261.63, 329.63, 392.0, 349.23, 261.63],
    bassMult: 0.5,
    drums: true,
    arpSpeed: 2
  },
  techno: {
    defaultBpm: 128,
    keyName: 'F# minor (Driving Techno)',
    chords: [
      [185.0, 220.0, 277.18], // F#m
      [146.83, 185.0, 220.0], // D
      [164.81, 207.65, 246.94], // E
      [185.0, 220.0, 277.18]  // F#m
    ],
    melody: [369.99, 440.0, 554.37, 493.88, 369.99, 329.63, 369.99, 440.0],
    bassMult: 0.5,
    drums: true,
    arpSpeed: 4
  },
  orchestral: {
    defaultBpm: 88,
    keyName: 'G Major (Symphonic Suite)',
    chords: [
      [196.0, 246.94, 293.66], // G
      [146.83, 185.0, 220.0],  // D
      [164.81, 196.0, 246.94], // Em
      [130.81, 164.81, 196.0]  // C
    ],
    melody: [392.0, 440.0, 493.88, 587.33, 523.25, 493.88, 440.0, 392.0],
    bassMult: 0.5,
    drums: false,
    arpSpeed: 2
  }
};

export function synthesizeWavBytes({ genre = 'synthwave', bpm, durationSec = 8, seed = 42 } = {}) {
  const preset = GENRE_PRESETS[genre] || GENRE_PRESETS.synthwave;
  const tempo = bpm || preset.defaultBpm;
  const sampleRate = 22050;
  const numSeconds = Math.max(4, Math.min(Number(durationSec) || 8, 24));
  const numSamples = sampleRate * numSeconds;
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // Standard RIFF WAVE header
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const beatDuration = 60 / tempo;
  const barDuration = beatDuration * 4;
  const stepDuration = beatDuration / preset.arpSpeed;
  const shift = ((seed % 7) - 3) * 0.02; // slight pitch uniqueness per prompt
  const pitchFactor = Math.pow(2, shift);

  // Simple delay buffer (250ms echo)
  const delaySamples = Math.floor(sampleRate * 0.24);
  const delayBuf = new Float32Array(delaySamples);
  let delayIdx = 0;

  let prng = (seed || 1337) >>> 0;
  const nextNoise = () => {
    prng = (prng * 1664525 + 1013904223) >>> 0;
    return (prng / 2147483648) - 1.0;
  };

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const barIdx = Math.floor(t / barDuration) % preset.chords.length;
    const chord = preset.chords[barIdx];
    const barTime = t % barDuration;
    const beatTime = t % beatDuration;
    const beatInBar = Math.floor(barTime / beatDuration);

    // 1. Warm Polyphonic Chord Pad
    let pad = 0;
    const padEnv = Math.min(1, barTime / 0.18) * Math.min(1, (barDuration - barTime) / 0.18);
    for (let c = 0; c < chord.length; c++) {
      const f = chord[c] * pitchFactor;
      pad += Math.sin(2 * Math.PI * f * t) * 0.55;
      pad += Math.sin(2 * Math.PI * (f * 1.003) * t) * 0.35;
    }
    pad = (pad / chord.length) * padEnv * 0.28;

    // 2. Deep Bassline
    const bassFreq = chord[0] * preset.bassMult * pitchFactor;
    const bassEnv = Math.exp(-beatTime * 3.5);
    const bass = (Math.sin(2 * Math.PI * bassFreq * t) * 0.75 + Math.tanh(Math.sin(2 * Math.PI * bassFreq * 2 * t) * 2.0) * 0.25) * bassEnv * 0.34;

    // 3. Arpeggio / Melody Lead
    const stepIdx = Math.floor(t / stepDuration) % preset.melody.length;
    const stepTime = t % stepDuration;
    const leadFreq = preset.melody[stepIdx] * pitchFactor;
    const leadEnv = Math.min(1, stepTime / 0.015) * Math.exp(-stepTime * 5.5);
    const lead = (Math.sin(2 * Math.PI * leadFreq * t) + 0.3 * Math.sin(2 * Math.PI * leadFreq * 2 * t)) * leadEnv * 0.22;

    // 4. Synthesized Percussion (Kick, Snare, Hi-Hat)
    let drums = 0;
    if (preset.drums) {
      // Kick on every beat (or 1 and 3 for lofi)
      if (genre !== 'lofi' || beatInBar === 0 || beatInBar === 2) {
        if (beatTime < 0.16) {
          const kFreq = 45 + 95 * Math.exp(-beatTime * 32);
          const kEnv = Math.exp(-beatTime * 18);
          drums += Math.sin(2 * Math.PI * kFreq * beatTime) * kEnv * 0.38;
        }
      }
      // Snare on beats 2 & 4 (beatInBar === 1 or 3)
      if ((beatInBar === 1 || beatInBar === 3) && beatTime < 0.14) {
        const sEnv = Math.exp(-beatTime * 24);
        drums += (nextNoise() * 0.7 + Math.sin(2 * Math.PI * 185 * beatTime) * 0.3) * sEnv * 0.22;
      }
      // Hi-hat on 8th notes
      const eighthTime = t % (beatDuration / 2);
      if (eighthTime < 0.035) {
        drums += nextNoise() * Math.exp(-eighthTime * 90) * 0.08;
      }
    }

    // Combine with stereo-style echo on lead + pad
    const dry = pad + bass + lead + drums;
    const echoed = delayBuf[delayIdx];
    delayBuf[delayIdx] = lead * 0.45 + pad * 0.25 + echoed * 0.25;
    delayIdx = (delayIdx + 1) % delaySamples;

    // Master fade-in & fade-out + soft limiter
    const masterEnv = Math.min(1, t / 0.15) * Math.min(1, (numSeconds - t) / 0.35);
    const sample = Math.tanh((dry + echoed * 0.35) * masterEnv * 1.15);
    const pcm16 = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
    view.setInt16(44 + i * 2, pcm16, true);
  }

  return new Uint8Array(buffer);
}

export async function generateMusicTrack(env, actor, rawInput = {}) {
  const input = generateMusicSchema.parse(rawInput);
  const preset = GENRE_PRESETS[input.genre] || GENRE_PRESETS.synthwave;
  const bpm = input.bpm || preset.defaultBpm;
  const title = input.title || `Trinity ${input.genre.toUpperCase()} · ${input.prompt.slice(0, 48)}`;
  const seed = [...input.prompt].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 777);

  const wavBytes = synthesizeWavBytes({
    genre: input.genre,
    bpm,
    durationSec: input.duration_sec,
    seed
  });

  const slug = slugify(title, 'trinity-skladba');
  const filename = `${slug}-${input.genre}-${bpm}bpm.wav`;
  const artifact = await createArtifact(env, {
    filename,
    content: wavBytes,
    contentType: 'audio/wav',
    notes: `Hudobná skladba (${preset.keyName}, ${bpm} BPM, ${input.duration_sec}s): ${input.prompt}`,
    createdBy: typeof actor === 'string' ? actor : (actor?.email || 'trinity')
  });

  if (env?.ARTIFACTS?.put) {
    try {
      await env.ARTIFACTS.put(`media/audio/${artifact.id}.mp3`, wavBytes, {
        httpMetadata: { contentType: 'audio/wav' }
      });
    } catch {}
  }

  const now = new Date().toISOString();
  const record = {
    id: artifact.id,
    media_type: 'music',
    title,
    prompt: input.prompt,
    style: input.genre,
    artifact_id: artifact.id,
    url: artifact.url,
    download_url: artifact.download_url,
    secondary_url: `/api/assistant/media/audio/${artifact.id}`,
    meta: {
      genre: input.genre,
      key_signature: preset.keyName,
      bpm,
      duration_sec: input.duration_sec,
      sample_rate_hz: 22050,
      format: 'WAV 16-bit PCM',
      size_bytes: wavBytes.byteLength
    },
    created_by: typeof actor === 'string' ? actor : (actor?.email || 'trinity'),
    created_at: now
  };

  await saveCreationRecord(env, record);

  await recordStepDocument(env, {
    title: `Hudobná produkcia: ${title}`,
    category: 'workflow_step',
    step_name: 'generate_music',
    actor: record.created_by,
    summary: `Vygenerovaná polyfonická skladba vo formáte WAV (${preset.keyName}, ${bpm} BPM, ${input.duration_sec}s).`,
    content: [
      `# 🎵 Hudobná skladba: ${title}`,
      ``,
      `- **Žáner a tónina:** ${preset.keyName}`,
      `- **Tempo:** ${bpm} BPM`,
      `- **Dĺžka:** ${input.duration_sec} sekúnd (22.05 kHz · 16-bit PCM WAV)`,
      `- **Zadanie:** ${input.prompt}`,
      `- **Prehrať / Stiahnuť WAV:** [Stiahnuť ${filename}](${artifact.download_url})`,
      `- **Priamy stream:** \`${artifact.url}\``
    ].join('\n'),
    receipt_id: `music:${artifact.id}`,
    tags: ['multimedia', 'music', input.genre]
  });

  return {
    ok: true,
    type: 'music',
    id: artifact.id,
    title,
    genre: input.genre,
    key_signature: preset.keyName,
    bpm,
    duration_sec: input.duration_sec,
    filename: artifact.filename,
    url: artifact.url,
    download_url: artifact.download_url,
    audio_stream_url: `/api/assistant/media/audio/${artifact.id}`,
    size_bytes: wavBytes.byteLength
  };
}

// ============================================================================
// 2. REAL ANIMATED 60FPS HTML5 CANVAS VIDEO STUDIO + WEBM EXPORT
// ============================================================================
function buildVideoScenes(prompt, title, style, scenesCount = 4, durationSec = 16) {
  const perScene = Math.max(3, Math.round(durationSec / scenesCount));
  const cleanPrompt = String(prompt || '').trim();
  const sentences = cleanPrompt
    .split(/(?<=[.!?])\s+|\s*[,;–—]\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  const defaultTemplates = [
    { badge: 'SCÉNA 01 · ÚVOD & VÍZIA', heading: title || 'Nová éra digitálnej inteligencie', caption: sentences[0] || cleanPrompt },
    { badge: 'SCÉNA 02 · DYNAMIKA & TECHNOLÓGIA', heading: 'Architektúra a živý výkon v reálnom čase', caption: sentences[1] || `Vizualizácia kľúčových prvkov: ${cleanPrompt.slice(0, 90)}` },
    { badge: 'SCÉNA 03 · HODNOTA & DOPAD', heading: 'Merateľné výsledky, dizajn a automatizácia', caption: sentences[2] || 'Prepojenie umelej inteligencie, cloudu a kreatívnej produkcie.' },
    { badge: 'SCÉNA 04 · FINÁLE & VÝZVA K AKCII', heading: 'Trinity Creative Studio · Budúcnosť je tu', caption: sentences[3] || 'Pripravené na okamžité nasadenie a zdieľanie.' },
    { badge: 'SCÉNA 05 · ROZŠÍRENÁ PERSPEKTÍVA', heading: 'Globálna škálovateľnosť na Cloudflare Edge', caption: sentences[4] || 'Rýchlosť, bezpečnosť a nekonečné možnosti tvorby.' },
    { badge: 'SCÉNA 06 · ZÁVEREČNÁ SYNTÉZA', heading: title || 'Trinity 11.0 Motion Engine', caption: sentences[5] || cleanPrompt }
  ];

  const scenes = [];
  for (let i = 0; i < scenesCount; i++) {
    const base = defaultTemplates[i % defaultTemplates.length];
    scenes.push({
      index: i + 1,
      badge: `SCÉNA 0${i + 1} · ${style.toUpperCase()}`,
      heading: i === 0 ? (title || base.heading) : (sentences[i] ? sentences[i].slice(0, 68) : base.heading),
      subtitle: sentences[i] || base.caption,
      duration_sec: perScene
    });
  }
  return scenes;
}

export function renderInteractiveVideoPlayerHtml({ title, prompt, style = 'cinematic', scenes, durationSec = 16 }) {
  const palettes = {
    cyberpunk: { bg1: '#050816', bg2: '#1a0b2e', accent: '#00f5d4', accent2: '#ff2a85', text: '#f8fafc' },
    cinematic: { bg1: '#070b14', bg2: '#172554', accent: '#f59e0b', accent2: '#38bdf8', text: '#f8fafc' },
    business:  { bg1: '#091326', bg2: '#0f2942', accent: '#38bdf8', accent2: '#10b981', text: '#f8fafc' },
    space:     { bg1: '#03040b', bg2: '#0f172a', accent: '#818cf8', accent2: '#c084fc', text: '#f8fafc' },
    nature:    { bg1: '#041f1e', bg2: '#0b3b24', accent: '#34d399', accent2: '#fbbf24', text: '#f8fafc' },
    abstract:  { bg1: '#140c24', bg2: '#2a123f', accent: '#f472b6', accent2: '#60a5fa', text: '#f8fafc' }
  };
  const pal = palettes[style] || palettes.cinematic;
  const scenesJson = JSON.stringify(scenes);

  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Trinity Cinema Video</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#050811;color:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column;min-height:100vh;overflow-x:hidden}
  .player-shell{position:relative;width:100%;max-width:1120px;margin:auto;padding:12px}
  .stage-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 70px rgba(0,0,0,.65)}
  canvas{width:100%;height:100%;display:block}
  .hud-top{position:absolute;top:14px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
  .badge{background:rgba(8,14,28,.76);backdrop-filter:blur(8px);border:1px solid ${pal.accent};color:${pal.accent};padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.08em}
  .timer{background:rgba(8,14,28,.76);padding:5px 11px;border-radius:999px;font-size:12px;font-variant-numeric:tabular-nums;border:1px solid rgba(255,255,255,.15)}
  .controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:12px;background:rgba(15,23,42,.88);border:1px solid rgba(255,255,255,.1);padding:10px 14px;border-radius:12px}
  .btn-group{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  button{background:rgba(255,255,255,.08);color:#f8fafc;border:1px solid rgba(255,255,255,.16);padding:8px 14px;border-radius:9px;font-weight:600;font-size:13px;cursor:pointer;transition:.18s}
  button:hover{background:rgba(255,255,255,.16)}
  button.primary{background:${pal.accent};color:#041019;border-color:${pal.accent}}
  .progress-wrap{flex:1;min-width:160px;height:8px;background:rgba(255,255,255,.12);border-radius:99px;overflow:hidden;cursor:pointer;margin:0 10px}
  .progress-bar{height:100%;width:0%;background:linear-gradient(90deg,${pal.accent},${pal.accent2});transition:width .1s linear}
  .scenes-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:10px}
  .scene-card{background:rgba(15,23,42,.65);border:1px solid rgba(255,255,255,.09);padding:9px 11px;border-radius:10px;cursor:pointer;text-align:left}
  .scene-card.active{border-color:${pal.accent};background:rgba(56,189,248,.12)}
  .scene-card small{display:block;font-size:10px;color:${pal.accent};font-weight:700}
  .scene-card b{display:block;font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style>
</head>
<body>
<div class="player-shell">
  <div class="stage-wrap" id="stage">
    <canvas id="cinema" width="1280" height="720"></canvas>
    <div class="hud-top">
      <span class="badge" id="hud-badge">TRINITY MOTION STUDIO · ${escapeHtml(style.toUpperCase())}</span>
      <span class="timer" id="hud-timer">00:00 / 00:${String(durationSec).padStart(2, '0')}</span>
    </div>
  </div>
  <div class="controls">
    <div class="btn-group">
      <button type="button" class="primary" id="play-btn">▶ Prehrať so zvukom</button>
      <button type="button" id="restart-btn">↺ Od začiatku</button>
      <button type="button" id="mute-btn">🔊 Zvuk ZAP</button>
    </div>
    <div class="progress-wrap" id="progress-wrap"><div class="progress-bar" id="progress-bar"></div></div>
    <div class="btn-group">
      <button type="button" id="record-webm-btn" title="Nahrá a stiahne skutočné .webm video">⬇ Exportovať .WebM Video</button>
      <button type="button" id="fs-btn">⛶ Celá obrazovka</button>
    </div>
  </div>
  <div class="scenes-strip" id="scenes-strip"></div>
</div>
<script>
const SCENES = ${scenesJson};
const PAL = ${JSON.stringify(pal)};
const TOTAL_SEC = ${Number(durationSec) || 16};
const STYLE = ${JSON.stringify(style)};
const canvas = document.getElementById('cinema');
const ctx = canvas.getContext('2d');

let playing = true;
let soundEnabled = true;
let elapsed = 0;
let lastTs = performance.now();
let audioCtx = null;
let nextNoteTime = 0;
let noteIdx = 0;

const particles = Array.from({length: 75}, (_, i) => ({
  x: (Math.sin(i * 17.3) * 0.5 + 0.5) * 1280,
  y: (Math.cos(i * 31.7) * 0.5 + 0.5) * 720,
  r: 1.5 + (i % 5) * 1.4,
  vx: ((i % 7) - 3) * 0.45,
  vy: ((i % 5) - 2) * 0.35 - 0.25,
  hue: i % 2 === 0 ? PAL.accent : PAL.accent2
}));

function initAudio() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
}

function triggerSynthNote() {
  if (!audioCtx || !soundEnabled || !playing) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  if (now < nextNoteTime) return;
  const scale = [220, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 329.63];
  const freq = scale[noteIdx % scale.length];
  noteIdx++;
  nextNoteTime = now + 0.38;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = STYLE === 'cyberpunk' ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.37);
}

function renderSceneCards() {
  const strip = document.getElementById('scenes-strip');
  strip.innerHTML = '';
  SCENES.forEach((sc, idx) => {
    const btn = document.createElement('div');
    btn.className = 'scene-card';
    btn.id = 'sc-card-' + idx;
    btn.innerHTML = '<small>' + sc.badge + '</small><b>' + sc.heading + '</b>';
    btn.onclick = () => {
      elapsed = ( idx / SCENES.length ) * TOTAL_SEC;
      playing = true;
      initAudio();
    };
    strip.appendChild(btn);
  });
}
renderSceneCards();

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ');
  let line = '';
  let curY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, curY);
      line = words[n] + ' ';
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, curY);
}

function drawFrame(now) {
  const dt = Math.min(0.1, (now - lastTs) / 1000);
  lastTs = now;
  if (playing) {
    elapsed += dt;
    if (elapsed >= TOTAL_SEC) elapsed = 0;
    triggerSynthNote();
  }

  const progress = Math.min(1, elapsed / TOTAL_SEC);
  const sceneIdx = Math.min(SCENES.length - 1, Math.floor(progress * SCENES.length));
  const scene = SCENES[sceneIdx] || SCENES[0];
  const sceneLocal = (progress * SCENES.length) - sceneIdx;

  document.getElementById('progress-bar').style.width = (progress * 100).toFixed(1) + '%';
  document.getElementById('hud-badge').textContent = scene.badge;
  document.getElementById('hud-timer').textContent =
    '00:' + String(Math.floor(elapsed)).padStart(2, '0') + ' / 00:' + String(TOTAL_SEC).padStart(2, '0');
  SCENES.forEach((_, idx) => {
    const el = document.getElementById('sc-card-' + idx);
    if (el) el.classList.toggle('active', idx === sceneIdx);
  });

  // 1. Dynamic gradient background
  const grad = ctx.createLinearGradient(0, 0, 1280, 720);
  grad.addColorStop(0, PAL.bg1);
  grad.addColorStop(1, PAL.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // 2. Animated perspective grid / waves
  ctx.save();
  ctx.strokeStyle = PAL.accent;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 10; row++) {
    const y = 420 + row * 32 + ((elapsed * 45) % 32);
    ctx.beginPath();
    for (let x = 0; x <= 1280; x += 40) {
      const wave = Math.sin((x * 0.008) + elapsed * 2.2 + row * 0.5) * 14;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();

  // 3. Animated glowing orbital rings
  ctx.save();
  ctx.translate(960, 330);
  for (let ring = 1; ring <= 3; ring++) {
    ctx.rotate(elapsed * 0.25 * (ring % 2 === 0 ? 1 : -1));
    ctx.strokeStyle = ring % 2 === 0 ? PAL.accent : PAL.accent2;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 75 * ring + Math.sin(elapsed * 2 + ring) * 8, 0, Math.PI * 1.65);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Floating particles
  for (const p of particles) {
    p.x = (p.x + p.vx + 1280) % 1280;
    p.y = (p.y + p.vy + 720) % 720;
    ctx.fillStyle = p.hue;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 5. Lower-third & Main Scene Typography with fade-in
  const alpha = Math.min(1, sceneLocal / 0.12) * Math.min(1, (1 - sceneLocal) / 0.12);
  ctx.save();
  ctx.globalAlpha = Math.max(0.15, alpha);

  // Accent bar
  ctx.fillStyle = PAL.accent;
  ctx.fillRect(82, 200, 6, 190);

  // Scene eyebrow
  ctx.fillStyle = PAL.accent;
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillText(scene.badge, 110, 225);

  // Main Heading
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px system-ui, sans-serif';
  wrapText(scene.heading, 110, 280, 780, 52);

  // Subtitle box
  ctx.fillStyle = 'rgba(8, 14, 28, 0.78)';
  ctx.fillRect(108, 430, 820, 110);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.strokeRect(108, 430, 820, 110);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '500 22px system-ui, sans-serif';
  wrapText(scene.subtitle, 130, 472, 775, 32);
  ctx.restore();

  requestAnimationFrame(drawFrame);
}
requestAnimationFrame(drawFrame);

document.getElementById('play-btn').onclick = () => {
  initAudio();
  playing = !playing;
  document.getElementById('play-btn').textContent = playing ? '⏸ Pozastaviť' : '▶ Prehrať so zvukom';
};
document.getElementById('restart-btn').onclick = () => {
  initAudio();
  elapsed = 0;
  playing = true;
};
document.getElementById('mute-btn').onclick = () => {
  initAudio();
  soundEnabled = !soundEnabled;
  document.getElementById('mute-btn').textContent = soundEnabled ? '🔊 Zvuk ZAP' : '🔇 Stlmené';
};
document.getElementById('progress-wrap').onclick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  elapsed = ratio * TOTAL_SEC;
};
document.getElementById('fs-btn').onclick = () => {
  const st = document.getElementById('stage');
  if (st.requestFullscreen) st.requestFullscreen();
};
document.getElementById('record-webm-btn').onclick = () => {
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
    alert('Prehliadač nepodporuje priamy MediaRecorder export.');
    return;
  }
  const btn = document.getElementById('record-webm-btn');
  btn.disabled = true;
  btn.textContent = '⏺ Nahrávam WebM (5s)…';
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trinity-video.webm';
    a.click();
    btn.disabled = false;
    btn.textContent = '⬇ Exportovať .WebM Video';
  };
  elapsed = 0;
  playing = true;
  recorder.start();
  setTimeout(() => recorder.stop(), 5000);
};
</script>
</body>
</html>`;
}

export async function generateVideoCreation(env, actor, rawInput = {}) {
  const input = generateVideoSchema.parse(rawInput);
  const title = input.title || `Trinity Video · ${input.prompt.slice(0, 48)}`;
  const scenes = buildVideoScenes(input.prompt, title, input.style, input.scenes_count, input.duration_sec);
  const html = renderInteractiveVideoPlayerHtml({
    title,
    prompt: input.prompt,
    style: input.style,
    scenes,
    durationSec: input.duration_sec
  });

  const slug = slugify(title, 'trinity-video');
  const filename = `${slug}-video.html`;
  const artifact = await createArtifact(env, {
    filename,
    content: html,
    contentType: 'text/html; charset=utf-8',
    notes: `Interaktívne 60fps HTML5/WebM Video (${input.style}, ${scenes.length} scén, ${input.duration_sec}s): ${input.prompt}`,
    createdBy: typeof actor === 'string' ? actor : (actor?.email || 'trinity')
  });

  const now = new Date().toISOString();
  const record = {
    id: artifact.id,
    media_type: 'video',
    title,
    prompt: input.prompt,
    style: input.style,
    artifact_id: artifact.id,
    url: artifact.url,
    download_url: artifact.download_url,
    secondary_url: null,
    meta: {
      style: input.style,
      duration_sec: input.duration_sec,
      scenes_count: scenes.length,
      scenes,
      resolution: '1280x720 (16:9 HD 60fps Canvas + WebM Export)'
    },
    created_by: typeof actor === 'string' ? actor : (actor?.email || 'trinity'),
    created_at: now
  };

  await saveCreationRecord(env, record);

  await recordStepDocument(env, {
    title: `Video produkcia: ${title}`,
    category: 'workflow_step',
    step_name: 'generate_video',
    actor: record.created_by,
    summary: `Vygenerované 16:9 animované video so zvukovou stopou a ${scenes.length} scénami (${input.duration_sec}s).`,
    content: [
      `# 🎬 Video produkcia: ${title}`,
      ``,
      `- **Štýl:** ${input.style}`,
      `- **Dĺžka & Rozlíšenie:** ${input.duration_sec}s · 1280×720 (60fps Canvas + WebM Export)`,
      `- **Prehrať video:** [Otvoriť prehrávač videa](${artifact.url})`,
      ``,
      `## Storyboard scén`,
      ...scenes.map(s => `- **${s.badge} — ${s.heading}:** ${s.subtitle}`)
    ].join('\n'),
    receipt_id: `video:${artifact.id}`,
    tags: ['multimedia', 'video', input.style]
  });

  return {
    ok: true,
    type: 'video',
    id: artifact.id,
    title,
    style: input.style,
    duration_sec: input.duration_sec,
    scenes_count: scenes.length,
    scenes,
    filename: artifact.filename,
    url: artifact.url,
    download_url: artifact.download_url
  };
}

// ============================================================================
// 3. INTERACTIVE 16:9 PRESENTATION / SLIDE DECK + PDF EXPORT
// ============================================================================
function buildPresentationSlides({ topic, title, subtitle, audience, slidesCount = 6, keyPoints = [] }) {
  const mainTitle = title || `Prezentácia: ${topic.slice(0, 64)}`;
  const sub = subtitle || `Strategický prehľad, architektúra a kľúčové prínosy pre: ${audience}`;
  const rawSentences = String(topic || '')
    .split(/(?<=[.!?])\s+|\s*[,;–—]\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 4);

  const points = keyPoints.length ? keyPoints : rawSentences;

  const catalog = [
    {
      num: 1,
      kicker: 'SLIDE 01 · EXECUTIVE SUMMARY',
      heading: mainTitle,
      lead: sub,
      bullets: [
        points[0] || `Hlavná téma a vízia: ${topic.slice(0, 120)}`,
        `Cieľová skupina: ${audience}`,
        'Kompletný návrh, kľúčové metriky a akčný plán nasadenia'
      ],
      metrics: [
        { label: 'CIEĽOVÝ DOPAD', value: '10× Rýchlosť' },
        { label: 'ARCHITEKTÚRA', value: 'Cloud & AI' },
        { label: 'STAV', value: 'Pripravené' }
      ],
      notes: 'Úvodný slajd predstavuje hlavnú víziu, kontext a hodnotovú ponuku.'
    },
    {
      num: 2,
      kicker: 'SLIDE 02 · VÝZVA & PRÍLEŽITOSŤ NA TRHU',
      heading: 'Prečo je táto téma kľúčová práve teraz',
      lead: points[1] || 'Súčasný trh vyžaduje rýchlu adaptáciu, automatizáciu a jasne merateľnú pridanú hodnotu.',
      bullets: [
        'Eliminácia manuálnych úzkych miest a zastaraných postupov',
        'Využitie moderných AI nástrojov a okamžitej cloudovej infraštruktúry',
        'Preukázateľná úspora nákladov a vyššia konverzia u klientov'
      ],
      metrics: [
        { label: 'ÚSPORA ČASU', value: '68 %' },
        { label: 'DOSTUPNOSŤ', value: '99.9 % Edge' },
        { label: 'NÁVRATNOSŤ (ROI)', value: '< 3 mesiace' }
      ],
      notes: 'Zdôraznite kontrast medzi starým riešením a novým prístupom.'
    },
    {
      num: 3,
      kicker: 'SLIDE 03 · ARCHITEKTÚRA & RIEŠENIE',
      heading: 'Ako funguje navrhované riešenie v praxi',
      lead: points[2] || `Komplexné riešenie postavené pre: ${mainTitle}`,
      bullets: [
        '1. Vstupná analýza dát, požiadaviek a cieľov projektu',
        '2. Automatizované spracovanie, tvorba výstupov a kontrola kvality',
        '3. Okamžité publikovanie, meranie výsledkov a priebežná optimalizácia'
      ],
      metrics: [
        { label: 'FAZA 1', value: 'Analýza & Návrh' },
        { label: 'FÁZA 2', value: 'Produkcia & AI' },
        { label: 'FÁZA 3', value: 'Rast & Škálovanie' }
      ],
      notes: 'Prejdite tri piliere riešenia krok za krokom.'
    },
    {
      num: 4,
      kicker: 'SLIDE 04 · KĽÚČOVÉ PRÍNOSY & FUNKCIE',
      heading: 'Hlavné konkurenčné výhody a hodnota',
      lead: points[3] || 'Spojenie špičkového dizajnu, bezpečnosti a plnej autonómie.',
      bullets: [
        'Okamžitá pripravenosť na produkčné nasadenie bez zložitej údržby',
        'Bezpečné spracovanie dát a transparentný audit každého kroku',
        'Jednoduché prepojenie na platobné brány, domény a firemné procesy'
      ],
      metrics: [
        { label: 'BEZPEČNOSŤ', value: 'AES-GCM 256' },
        { label: 'INTEGRÁCIA', value: 'API & Webhooks' },
        { label: 'ŠKÁLOVANIE', value: 'Globálne' }
      ],
      notes: 'Zamerajte sa na konkrétne benefity pre koncového zákazníka alebo investora.'
    },
    {
      num: 5,
      kicker: 'SLIDE 05 · EKONOMIKA & PLÁN IMPLEMENTÁCIE',
      heading: 'Časový harmonogram a obchodný model',
      lead: points[4] || 'Rozfázovanie projektu do rýchlych a kontrolovateľných míľnikov.',
      bullets: [
        'Týždeň 1–2: Príprava prostredia, prototyp a validácia so zainteresovanými stranami',
        'Týždeň 3–4: Spustenie ostrej prevádzky, meranie KPI a zber spätnej väzby',
        'Mesiac 2+: Škálovanie, automatizácia predaja a rozširovanie portfólia'
      ],
      metrics: [
        { label: 'ŠTART PROJEKTU', value: 'Okamžite' },
        { label: 'PRVÝ VÝSTUP', value: 'Do 48 hodín' },
        { label: 'CIEĽ', value: 'Dlhodobý rast' }
      ],
      notes: 'Ukážte realistický a rýchly plán dodania.'
    },
    {
      num: 6,
      kicker: 'SLIDE 06 · ZÁVER & ĎALŠIE KROKY',
      heading: 'Zhrnutie a výzva k spolupráci',
      lead: points[5] || `Ďakujeme za pozornosť · ${mainTitle}`,
      bullets: [
        'Schválenie cieľového rozsahu a prioritných míľnikov',
        'Spustenie pilotnej prevádzky a vyhodnotenie prvých metrík',
        'Kontakt a okamžitá podpora tímu Trinity AI Studio'
      ],
      metrics: [
        { label: 'PRIPRAVENOSŤ', value: '100 %' },
        { label: 'PODPORA', value: '24/7 Trinity AI' },
        { label: 'AKCIA', value: 'Spustiť dnes →' }
      ],
      notes: 'Záverečný slajd — vyzvite publikum na otázky a potvrdenie ďalšieho kroku.'
    }
  ];

  const extra = [];
  for (let i = 0; i < slidesCount; i++) {
    const template = catalog[i % catalog.length];
    extra.push({
      ...template,
      num: i + 1,
      kicker: `SLIDE ${String(i + 1).padStart(2, '0')} · ${template.kicker.split('·')[1]?.trim() || 'PREHĽAD'}`
    });
  }
  return extra;
}

export function renderPresentationDeckHtml({ title, subtitle, audience, theme = 'midnight-tech', slides }) {
  const themes = {
    'midnight-tech': { bg: '#070d19', card: '#0f172a', accent: '#38bdf8', accent2: '#818cf8', text: '#f8fafc', muted: '#94a3b8' },
    'cyber-gold':    { bg: '#0c0a06', card: '#18130a', accent: '#f59e0b', accent2: '#fbbf24', text: '#fef3c7', muted: '#d6d3d1' },
    'emerald-growth':{ bg: '#04130e', card: '#062419', accent: '#10b981', accent2: '#34d399', text: '#ecfdf5', muted: '#a7f3d0' },
    'clean-light':   { bg: '#f8fafc', card: '#ffffff', accent: '#0284c7', accent2: '#4f46e5', text: '#0f172a', muted: '#475569' },
    'royal-violet':  { bg: '#0f0720', card: '#1e1038', accent: '#c084fc', accent2: '#f472b6', text: '#faf5ff', muted: '#d8b4fe' }
  };
  const pal = themes[theme] || themes['midnight-tech'];

  const slideSections = slides.map((s, idx) => `
    <section class="slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
      <div class="slide-header">
        <span class="slide-kicker">${escapeHtml(s.kicker)}</span>
        <span class="slide-counter">${idx + 1} / ${slides.length}</span>
      </div>
      <h1>${escapeHtml(s.heading)}</h1>
      <p class="slide-lead">${escapeHtml(s.lead)}</p>
      <div class="slide-metrics">
        ${(s.metrics || []).map(m => `<div class="metric-box"><small>${escapeHtml(m.label)}</small><strong>${escapeHtml(m.value)}</strong></div>`).join('')}
      </div>
      <ul class="slide-bullets">
        ${(s.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
      <footer class="slide-footer">
        <span>✦ ${escapeHtml(title)}</span>
        <span>Publikum: ${escapeHtml(audience)}</span>
      </footer>
    </section>
  `).join('\n');

  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Trinity Prezentácia</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${pal.bg};color:${pal.text};font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh;display:flex;flex-direction:column}
  .deck-toolbar{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;background:rgba(0,0,0,.35);border-bottom:1px solid rgba(148,163,184,.2);gap:10px;flex-wrap:wrap}
  .deck-toolbar b{font-size:14px}
  .deck-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  button{background:rgba(148,163,184,.15);color:${pal.text};border:1px solid rgba(148,163,184,.3);padding:7px 13px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px}
  button.primary{background:${pal.accent};color:#050b14;border-color:${pal.accent}}
  .deck-stage{flex:1;display:flex;align-items:center;justify-content:center;padding:20px}
  .slide{display:none;width:100%;max-width:1080px;aspect-ratio:16/9;background:${pal.card};border:1px solid rgba(148,163,184,.22);border-radius:20px;padding:42px 52px;box-shadow:0 24px 68px rgba(0,0,0,.45);flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
  .slide.active{display:flex}
  .slide-header{display:flex;justify-content:space-between;align-items:center}
  .slide-kicker{color:${pal.accent};font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
  .slide-counter{font-size:12px;color:${pal.muted};font-weight:700}
  .slide h1{font-size:clamp(24px,3.2vw,40px);line-height:1.15;margin-top:8px}
  .slide-lead{font-size:clamp(15px,1.6vw,20px);color:${pal.muted};margin-top:8px}
  .slide-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:18px 0}
  .metric-box{background:rgba(148,163,184,.08);border-left:4px solid ${pal.accent};padding:12px 16px;border-radius:10px}
  .metric-box small{display:block;font-size:11px;color:${pal.muted};font-weight:700}
  .metric-box strong{display:block;font-size:clamp(16px,2vw,24px);margin-top:4px;color:${pal.accent}}
  .slide-bullets{list-style:none;display:grid;gap:10px;margin:8px 0}
  .slide-bullets li{font-size:clamp(14px,1.4vw,18px);padding-left:24px;position:relative}
  .slide-bullets li::before{content:"◆";position:absolute;left:0;color:${pal.accent}}
  .slide-footer{display:flex;justify-content:space-between;font-size:12px;color:${pal.muted};border-top:1px solid rgba(148,163,184,.16);padding-top:12px;margin-top:12px}
  @media print {
    .deck-toolbar{display:none}
    .deck-stage{display:block;padding:0}
    .slide{display:flex !important;page-break-after:always;margin-bottom:20px;box-shadow:none}
  }
</style>
</head>
<body>
  <header class="deck-toolbar">
    <b>📊 ${escapeHtml(title)}</b>
    <div class="deck-actions">
      <button type="button" id="prev-btn">← Predchádzajúci</button>
      <span id="page-indicator">1 / ${slides.length}</span>
      <button type="button" class="primary" id="next-btn">Ďalší slajd →</button>
      <button type="button" id="print-btn">🖨️ Tlačiť / Uložiť PDF</button>
      <button type="button" id="fs-btn">⛶ Celá obrazovka</button>
    </div>
  </header>
  <main class="deck-stage" id="deck-stage">
    ${slideSections}
  </main>
<script>
  const slides = Array.from(document.querySelectorAll('.slide'));
  let cur = 0;
  function show(idx) {
    cur = (idx + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === cur));
    document.getElementById('page-indicator').textContent = (cur + 1) + ' / ' + slides.length;
  }
  document.getElementById('prev-btn').onclick = () => show(cur - 1);
  document.getElementById('next-btn').onclick = () => show(cur + 1);
  document.getElementById('print-btn').onclick = () => window.print();
  document.getElementById('fs-btn').onclick = () => {
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  };
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); show(cur + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
  });
</script>
</body>
</html>`;
}

export async function generatePresentationDeck(env, actor, rawInput = {}) {
  const input = generatePresentationSchema.parse(rawInput);
  const title = input.title || `Prezentácia: ${input.topic.slice(0, 56)}`;
  const subtitle = input.subtitle || `Kompletná prezentácia a strategický prehľad (${input.audience})`;
  const slides = buildPresentationSlides({
    topic: input.topic,
    title,
    subtitle,
    audience: input.audience,
    slidesCount: input.slides_count,
    keyPoints: input.key_points
  });

  const html = renderPresentationDeckHtml({
    title,
    subtitle,
    audience: input.audience,
    theme: input.theme,
    slides
  });

  const slug = slugify(title, 'trinity-prezentacia');
  const htmlFilename = `${slug}-prezentacia.html`;
  const pdfFilename = `${slug}-prezentacia.pdf`;

  const htmlArtifact = await createArtifact(env, {
    filename: htmlFilename,
    content: html,
    contentType: 'text/html; charset=utf-8',
    notes: `Interaktívna 16:9 HTML5 prezentácia (${slides.length} slajdov, téma ${input.theme}): ${input.topic}`,
    createdBy: typeof actor === 'string' ? actor : (actor?.email || 'trinity')
  });

  const pdfTextContent = slides.map(s =>
    `${s.kicker}\n${s.heading}\n${s.lead}\n` +
    s.bullets.map(b => `  * ${b}`).join('\n') + '\n' +
    s.metrics.map(m => `  [${m.label}: ${m.value}]`).join('  ')
  ).join('\n\n----------------------------------------\n\n');

  const pdfArtifact = await createPdfArtifact(env, {
    filename: pdfFilename,
    title,
    content: pdfTextContent,
    author: 'Trinity Presentation Studio',
    notes: `PDF verzia prezentácie (${slides.length} slajdov): ${title}`,
    createdBy: typeof actor === 'string' ? actor : (actor?.email || 'trinity')
  });

  const now = new Date().toISOString();
  const record = {
    id: htmlArtifact.id,
    media_type: 'presentation',
    title,
    prompt: input.topic,
    style: input.theme,
    artifact_id: htmlArtifact.id,
    url: htmlArtifact.url,
    download_url: htmlArtifact.download_url,
    secondary_url: pdfArtifact.download_url,
    meta: {
      theme: input.theme,
      audience: input.audience,
      slides_count: slides.length,
      pdf_url: pdfArtifact.url,
      pdf_download_url: pdfArtifact.download_url,
      slides
    },
    created_by: typeof actor === 'string' ? actor : (actor?.email || 'trinity'),
    created_at: now
  };

  await saveCreationRecord(env, record);

  await recordStepDocument(env, {
    title: `Prezentácia (Slide Deck + PDF): ${title}`,
    category: 'workflow_step',
    step_name: 'generate_presentation',
    actor: record.created_by,
    summary: `Vygenerovaná ${slides.length}-slajdová interaktívna 16:9 prezentácia (.html) aj tlačový PDF dokument (.pdf).`,
    content: [
      `# 📊 Prezentácia: ${title}`,
      ``,
      `- **Podtitulok:** ${subtitle}`,
      `- **Publikum:** ${input.audience}`,
      `- **Téma:** ${input.theme} (${slides.length} slajdov)`,
      `- **Interaktívny Slide Deck (16:9 HTML5):** [Otvoriť prezentáciu](${htmlArtifact.url})`,
      `- **PDF Export na stiahnutie:** [Stiahnuť PDF (${pdfFilename})](${pdfArtifact.download_url})`,
      ``,
      `## Obsah slajdov`,
      ...slides.map(s => `### ${s.kicker} — ${s.heading}\n${s.lead}\n${s.bullets.map(b => `- ${b}`).join('\n')}`)
    ].join('\n'),
    receipt_id: `presentation:${htmlArtifact.id}`,
    tags: ['multimedia', 'presentation', input.theme]
  });

  return {
    ok: true,
    type: 'presentation',
    id: htmlArtifact.id,
    title,
    subtitle,
    theme: input.theme,
    slides_count: slides.length,
    slides,
    filename: htmlArtifact.filename,
    url: htmlArtifact.url,
    download_url: htmlArtifact.download_url,
    pdf_url: pdfArtifact.url,
    pdf_download_url: pdfArtifact.download_url
  };
}

// ============================================================================
// 4. PHOTO & VISUAL ARTWORK STUDIO (Workers AI Flux + High-Res SVG Fallback)
// ============================================================================
export function renderHighResSvgArtwork({ title, prompt, style = 'photorealistic', aspectRatio = '16:9' }) {
  const dims = aspectRatio === '1:1' ? [1024, 1024] : aspectRatio === '9:16' ? [768, 1365] : [1280, 720];
  const [w, h] = dims;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#060b18"/>
      <stop offset="50%" stop-color="#0f2447"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <radialGradient id="glow" cx="65%" cy="42%" r="48%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="#818cf8" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#060b18" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <circle cx="${Math.round(w * 0.66)}" cy="${Math.round(h * 0.44)}" r="${Math.round(Math.min(w, h) * 0.26)}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-opacity="0.45"/>
  <circle cx="${Math.round(w * 0.66)}" cy="${Math.round(h * 0.44)}" r="${Math.round(Math.min(w, h) * 0.18)}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.4"/>
  <text x="64" y="${Math.round(h * 0.36)}" fill="#38bdf8" font-family="system-ui,sans-serif" font-size="18" font-weight="700" letter-spacing="3">TRINITY VISUAL STUDIO · ${escapeHtml(style.toUpperCase())}</text>
  <text x="64" y="${Math.round(h * 0.46)}" fill="#ffffff" font-family="system-ui,sans-serif" font-size="42" font-weight="800">${escapeHtml(title.slice(0, 42))}</text>
  <text x="64" y="${Math.round(h * 0.55)}" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="22">${escapeHtml(prompt.slice(0, 72))}</text>
</svg>`;
}

export async function generatePhotoCreation(env, actor, rawInput = {}) {
  const input = generatePhotoStudioSchema.parse(rawInput);
  const title = input.title || `Fotografia: ${input.prompt.slice(0, 48)}`;
  const stylePrompts = {
    photorealistic: 'photorealistic, ultra-detailed 8k photography, natural studio lighting, sharp focus',
    cinematic: 'cinematic film still, anamorphic lens, dramatic volumetric lighting, color graded',
    cyberpunk: 'cyberpunk neon aesthetic, futuristic reflective surfaces, teal and magenta lighting',
    portrait: 'professional studio portrait photography, 85mm f/1.4 lens, soft key light, expressive detail',
    product: 'luxury commercial product photography, clean studio backdrop, rim lighting, macro detail',
    logo: 'minimalist modern vector emblem design, clean geometric lines, high contrast, iconic brand mark',
    'digital-art': 'masterpiece concept art illustration, vibrant colors, dynamic composition',
    poster: 'high-impact editorial poster art, bold visual hierarchy, dramatic composition'
  };
  const enrichedPrompt = `${input.prompt} (${stylePrompts[input.style] || stylePrompts.photorealistic}, aspect ratio ${input.aspect_ratio})`;
  const model = env?.IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';

  let url = '';
  let downloadUrl = '';
  let artifactId = crypto.randomUUID();
  let usedModel = model;

  if (env?.AI?.run && env?.ARTIFACTS?.put) {
    try {
      const imageInput = { prompt: enrichedPrompt };
      if (input.seed !== undefined) imageInput.seed = input.seed;
      const generated = await env.AI.run(model, imageInput);
      let bytes;
      if (typeof generated?.image === 'string') bytes = Uint8Array.from(Buffer.from(generated.image, 'base64'));
      else if (generated instanceof Uint8Array) bytes = generated;
      else if (generated instanceof ArrayBuffer) bytes = new Uint8Array(generated);

      if (bytes && bytes.length > 0) {
        const key = `media/images/${artifactId}.jpg`;
        await env.ARTIFACTS.put(key, bytes, {
          httpMetadata: { contentType: 'image/jpeg' },
          customMetadata: { model, prompt: enrichedPrompt.slice(0, 500) }
        });
        url = `/api/assistant/media/images/${artifactId}`;
        downloadUrl = url;
      }
    } catch {
      // Fallback to high-res SVG artifact below
    }
  }

  if (!url) {
    usedModel = 'trinity-vector-studio-svg';
    const svg = renderHighResSvgArtwork({
      title,
      prompt: input.prompt,
      style: input.style,
      aspectRatio: input.aspect_ratio
    });
    const art = await createArtifact(env, {
      filename: `${slugify(title, 'trinity-foto')}.svg`,
      content: svg,
      contentType: 'image/svg+xml; charset=utf-8',
      notes: `Vizuálna grafika (${input.style}): ${input.prompt}`,
      createdBy: typeof actor === 'string' ? actor : (actor?.email || 'trinity')
    });
    artifactId = art.id;
    url = art.url;
    downloadUrl = art.download_url;
  }

  const now = new Date().toISOString();
  const record = {
    id: artifactId,
    media_type: 'photo',
    title,
    prompt: input.prompt,
    style: input.style,
    artifact_id: artifactId,
    url,
    download_url: downloadUrl,
    secondary_url: null,
    meta: {
      style: input.style,
      aspect_ratio: input.aspect_ratio,
      model: usedModel
    },
    created_by: typeof actor === 'string' ? actor : (actor?.email || 'trinity'),
    created_at: now
  };

  await saveCreationRecord(env, record);

  await recordStepDocument(env, {
    title: `Fotografia & Vizuál: ${title}`,
    category: 'workflow_step',
    step_name: 'generate_photo',
    actor: record.created_by,
    summary: `Vygenerovaná fotografia/vizuál v štýle ${input.style} (${input.aspect_ratio}).`,
    content: [
      `# 📸 Fotografia & Vizuál: ${title}`,
      ``,
      `- **Štýl:** ${input.style} (${input.aspect_ratio})`,
      `- **Model:** \`${usedModel}\``,
      `- **Zadanie:** ${input.prompt}`,
      `- **Odkaz na obrázok:** [Zobraziť obrázok](${url})`
    ].join('\n'),
    receipt_id: `photo:${artifactId}`,
    tags: ['multimedia', 'photo', input.style]
  });

  return {
    ok: true,
    type: 'photo',
    id: artifactId,
    title,
    style: input.style,
    aspect_ratio: input.aspect_ratio,
    model: usedModel,
    url,
    download_url: downloadUrl
  };
}

// ============================================================================
// 5. CREATIVE PACKS ("A TAKÉ": INFOGRAPHICS, SOCIAL MEDIA PACKS, STORYBOARDS)
// ============================================================================
export async function generateCreativePack(env, actor, rawInput = {}) {
  const input = generateCreativePackSchema.parse(rawInput);
  const typeLabels = {
    infographic: 'Interaktívna Infografika & Plagát',
    social_pack: 'Kampaň pre Sociálne Siete (Instagram · LinkedIn · TikTok)',
    storyboard: 'Režisérsky Storyboard & Scenár',
    brand_kit: 'Brand Identity & Dizajn Manuál'
  };
  const label = typeLabels[input.pack_type] || typeLabels.infographic;
  const title = input.title || `${label}: ${input.prompt.slice(0, 46)}`;

  const html = `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#070c18;color:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:28px;line-height:1.55}
  .wrap{max-width:1040px;margin:auto}
  .hero{background:linear-gradient(135deg,#0f172a,#1e1b4b);border:1px solid rgba(56,189,248,.35);border-radius:20px;padding:32px;margin-bottom:22px}
  .eyebrow{color:#38bdf8;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
  h1{font-size:32px;margin:8px 0}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
  .card{background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;padding:22px}
  .card h3{color:#38bdf8;margin-bottom:8px;font-size:18px}
  .tag{display:inline-block;background:rgba(56,189,248,.14);color:#38bdf8;padding:3px 10px;border-radius:99px;font-size:12px;margin-top:10px}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <span class="eyebrow">TRINITY CREATIVE PACK · ${escapeHtml(input.pack_type.toUpperCase())}</span>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(input.prompt)}</p>
  </header>
  <section class="grid">
    <article class="card"><h3>1. Hlavný vizuálny koncept & Hook</h3><p>Výrazná titulná kompozícia navrhnutá pre okamžité zaujatie pozornosti do 3 sekúnd. Kľúčové posolstvo: <b>${escapeHtml(input.prompt.slice(0, 120))}</b></p><span class="tag">Hero Visual · 1080×1080 & 16:9</span></article>
    <article class="card"><h3>2. Štruktúrované dáta & Argumentácia</h3><p>Prehľadné rozdelenie na 3 hlavné piliere hodnoty, vizuálne KPI ukazovatele a jasný kontrast pred/po nasadení.</p><span class="tag">Infografika & Dáta</span></article>
    <article class="card"><h3>3. Copywriting, Hashtagy & Výzva k akcii (CTA)</h3><p>Pripravené texty pre posty, príbehy (Stories/Reels) a priamu konverziu klientov.</p><span class="tag">#TrinityAI #DigitalStudio #Inovacie</span></article>
  </section>
</div>
</body>
</html>`;

  const slug = slugify(title, 'trinity-kreativny-balik');
  const artifact = await createArtifact(env, {
    filename: `${slug}-${input.pack_type}.html`,
    content: html,
    contentType: 'text/html; charset=utf-8',
    notes: `${label}: ${input.prompt}`,
    createdBy: typeof actor === 'string' ? actor : (actor?.email || 'trinity')
  });

  const now = new Date().toISOString();
  const record = {
    id: artifact.id,
    media_type: 'creative_pack',
    title,
    prompt: input.prompt,
    style: input.pack_type,
    artifact_id: artifact.id,
    url: artifact.url,
    download_url: artifact.download_url,
    secondary_url: null,
    meta: { pack_type: input.pack_type, theme: input.theme },
    created_by: typeof actor === 'string' ? actor : (actor?.email || 'trinity'),
    created_at: now
  };
  await saveCreationRecord(env, record);

  await recordStepDocument(env, {
    title: `Kreatívny balík (${label}): ${title}`,
    category: 'workflow_step',
    step_name: 'generate_creative_pack',
    actor: record.created_by,
    summary: `Vygenerovaný kreatívny balík typu ${input.pack_type}: ${input.prompt}`,
    content: `# ✨ ${title}\n\n- **Typ:** ${label}\n- **Zadanie:** ${input.prompt}\n- **Otvoriť výstup:** [${artifact.filename}](${artifact.url})`,
    receipt_id: `creative:${artifact.id}`,
    tags: ['multimedia', input.pack_type]
  });

  return {
    ok: true,
    type: 'creative_pack',
    pack_type: input.pack_type,
    id: artifact.id,
    title,
    filename: artifact.filename,
    url: artifact.url,
    download_url: artifact.download_url
  };
}

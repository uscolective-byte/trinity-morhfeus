import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateVideoSchema,
  generateMusicSchema,
  buildVideoScenes,
  renderInteractiveVideoPlayerHtml,
  generateVideoCreation,
  listMultimediaCreations
} from '../src/multimedia-studio.js';
import { runTool } from '../src/tools.js';

function createMockEnv() {
  const store = new Map();
  const dbRows = [];

  const ARTIFACTS = {
    async put(key, body, options = {}) {
      store.set(key, { body, options });
      return { key };
    },
    async get(key) {
      if (!store.has(key)) return null;
      const item = store.get(key);
      return {
        body: item.body,
        httpMetadata: item.options.httpMetadata || {},
        customMetadata: item.options.customMetadata || {},
        writeHttpMetadata(headers) {
          if (item.options.httpMetadata?.contentType) {
            headers.set('Content-Type', item.options.httpMetadata.contentType);
          }
        }
      };
    }
  };

  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.includes('INSERT INTO ops_multimedia_creations')) {
                dbRows.push({
                  id: args[0],
                  media_type: args[1],
                  title: args[2],
                  prompt: args[3],
                  style: args[4],
                  artifact_id: args[5],
                  url: args[6],
                  download_url: args[7],
                  secondary_url: args[8],
                  meta_json: args[9],
                  created_by: args[10],
                  created_at: args[11]
                });
              }
              return { success: true };
            },
            async all() {
              let rows = [...dbRows];
              if (sql.includes('WHERE media_type = ?')) {
                rows = rows.filter(r => r.media_type === args[0]);
              }
              return { results: rows };
            },
            async first() {
              if (sql.includes('SELECT installed,enabled FROM ops_plugins')) {
                return { installed: 1, enabled: 1 };
              }
              return dbRows[0] || null;
            }
          };
        }
      };
    }
  };

  return { ARTIFACTS, DB };
}

test('generateVideoSchema: validates input parameters correctly', () => {
  const valid = generateVideoSchema.parse({
    prompt: 'Prezentačné video pre autonómny cloud Trinity',
    title: 'Trinity Cloud Demo',
    style: 'cyberpunk',
    duration_sec: 20,
    scenes_count: 5
  });

  assert.equal(valid.style, 'cyberpunk');
  assert.equal(valid.duration_sec, 20);
  assert.equal(valid.scenes_count, 5);

  const defaults = generateVideoSchema.parse({
    prompt: 'Jednoduché promo video'
  });
  assert.equal(defaults.style, 'cinematic');
  assert.equal(defaults.duration_sec, 16);
  assert.equal(defaults.scenes_count, 4);
});

test('buildVideoScenes: produces complete scenes with all required properties', () => {
  const scenes = buildVideoScenes(
    'Prvá veta o vízii. Druhá veta o architektúre. Tretia veta o výsledkoch a automatizácii. Štvrtá veta o nasadení.',
    'Test Video Title',
    'cyberpunk',
    4,
    16
  );

  assert.equal(scenes.length, 4);
  scenes.forEach((sc, idx) => {
    assert.equal(sc.index, idx + 1);
    assert.equal(sc.scene_index, idx + 1);
    assert.ok(sc.badge && sc.badge.includes('CYBERPUNK'), 'badge contains style');
    assert.ok(typeof sc.heading === 'string' && sc.heading.length > 0, 'heading is present');
    assert.ok(typeof sc.title === 'string' && sc.title.length > 0, 'title is present');
    assert.ok(typeof sc.subtitle === 'string' && sc.subtitle.length > 0, 'subtitle is present');
    assert.ok(typeof sc.caption === 'string' && sc.caption.length > 0, 'caption is present');
    assert.ok(typeof sc.visual_prompt === 'string' && sc.visual_prompt.length > 0, 'visual_prompt is present');
    assert.ok(typeof sc.audio_mood === 'string' && sc.audio_mood.includes('cyberpunk'), 'audio_mood matches style');
    assert.equal(sc.duration_sec, 4);
  });
});

test('renderInteractiveVideoPlayerHtml: generates complete HTML5 canvas player with WebM export', () => {
  const scenes = buildVideoScenes('Skúšobné video pre vizualizáciu.', 'Skúška', 'cinematic', 4, 16);
  const html = renderInteractiveVideoPlayerHtml({
    title: 'Skúška',
    prompt: 'Skúšobné video pre vizualizáciu.',
    style: 'cinematic',
    scenes,
    durationSec: 16
  });

  assert.ok(html.includes('<!doctype html>'), 'Valid HTML doctype');
  assert.ok(html.includes('<canvas id="cinema" width="1280" height="720"></canvas>'), 'Contains 16:9 720p canvas');
  assert.ok(html.includes('id="play-btn"'), 'Contains play button');
  assert.ok(html.includes('id="record-webm-btn"'), 'Contains record WebM button');
  assert.ok(html.includes('TOTAL_SEC = 16'), 'Contains duration');
  assert.ok(html.includes('mediaRecorderInstance'), 'Contains responsive WebM recorder');
  assert.ok(html.includes('triggerSynthNote'), 'Contains WebAudio synthesizer');
});

test('generateVideoCreation: creates artifact, records creation and returns creation object', async () => {
  const env = createMockEnv();
  const actor = { email: 'basterix@auru.space' };

  const result = await generateVideoCreation(env, actor, {
    prompt: 'Prezentácia Trinity Cloud OS s vysokým výkonom.',
    title: 'Trinity Showcase',
    style: 'cinematic',
    duration_sec: 16,
    scenes_count: 4
  });

  assert.equal(result.ok, true);
  assert.equal(result.type, 'video');
  assert.equal(result.kind, 'video');
  assert.equal(result.media_type, 'video');
  assert.ok(result.id, 'Has artifact ID');
  assert.ok(result.url.includes('/api/assistant/files/'), 'Has file URL');
  assert.ok(result.player_url, 'Has player_url');
  assert.ok(result.download_url, 'Has download_url');
  assert.ok(result.secondary_url, 'Has secondary_url');
  assert.equal(result.scenes.length, 4);

  // Overenie obálky creation pre kompatibilitu s frontendom
  assert.ok(result.creation, 'Has creation wrapper');
  assert.equal(result.creation.title, 'Trinity Showcase');
  assert.equal(result.creation.style, 'cinematic');
  assert.equal(result.creation.scenes.length, 4);

  // Overenie listovania v multimédiách
  const listByKind = await listMultimediaCreations(env, { kind: 'video' });
  assert.equal(listByKind.items.length, 1);
  assert.equal(listByKind.items[0].kind, 'video');
  assert.equal(listByKind.items[0].media_type, 'video');

  const listByMediaType = await listMultimediaCreations(env, { media_type: 'video' });
  assert.equal(listByMediaType.items.length, 1);
});

test('tools.js: runTool("generate_video") invokes engine cleanly', async () => {
  const env = createMockEnv();
  const agent = { id: 'test-agent', name: 'Tester' };

  const toolRes = await runTool(
    env,
    agent,
    'generate_video',
    {
      prompt: 'Autonómne domény a smart treasury',
      title: 'Tetrakis Treasury Video',
      style: 'cyberpunk',
      duration_sec: 16,
      scenes_count: 4
    }
  );

  assert.equal(toolRes.ok, true);
  assert.equal(toolRes.type, 'video');
  assert.ok(toolRes._evidence, 'Truth Policy evidence is generated');
  assert.equal(toolRes._evidence.receipt_id, `video:${toolRes.id}`);
  assert.ok(toolRes.url, 'url is present');
  assert.ok(toolRes.creation, 'creation object is present');
});

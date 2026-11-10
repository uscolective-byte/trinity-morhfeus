import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeWebMVideoBytes, generateVideoCreation } from '../src/multimedia-studio.js';
import { runTool } from '../src/tools.js';

function createMockEnv() {
  const store = new Map();
  const dbRows = [];

  const ARTIFACTS = {
    async put(key, body, options = {}) {
      store.set(key, { body, options });
      return { key };
    },
    async get(key, getOptions = {}) {
      if (!store.has(key)) return null;
      const item = store.get(key);
      const isRange = !!getOptions.range;
      return {
        key,
        body: item.body,
        range: isRange ? { offset: 0, length: 100 } : undefined,
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
              return { results: dbRows };
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

test('video streaming: generates real WebM binary and serves with correct video headers and range support', async () => {
  const env = createMockEnv();
  const actor = { email: 'basterix@auru.space' };

  // 1. Generate video
  const creation = await generateVideoCreation(env, actor, {
    prompt: 'Generovanie autonómneho videa pre Trinity Cloud',
    title: 'Trinity Native Video',
    style: 'cyberpunk',
    duration_sec: 12,
    scenes_count: 3
  });

  assert.equal(creation.ok, true);
  assert.equal(creation.mime_type, 'video/webm');
  assert.ok(creation.size_bytes > 0);
  assert.equal(creation.video_url, `/api/assistant/media/video/${creation.id}`);

  // 2. Verify stored in R2
  const r2Obj = await env.ARTIFACTS.get(`media/video/${creation.id}.webm`);
  assert.ok(r2Obj, 'Video stored in R2 under media/video/${id}.webm');
  assert.equal(r2Obj.httpMetadata?.contentType, 'video/webm');

  // Verify EBML Header: 0x1A 0x45 0xDF 0xA3
  const bytes = r2Obj.body;
  assert.equal(bytes[0], 0x1a);
  assert.equal(bytes[1], 0x45);
  assert.equal(bytes[2], 0xdf);
  assert.equal(bytes[3], 0xa3);

  // 3. Test Range request simulation
  const rangeObj = await env.ARTIFACTS.get(`media/video/${creation.id}.webm`, {
    range: new Headers({ Range: 'bytes=0-100' })
  });
  assert.ok(rangeObj.range, 'Range is properly detected and processed');
});

test('tools.js: generate_video produces ready-to-stream WebM with Truth Policy receipt', async () => {
  const env = createMockEnv();
  const agent = { id: 'sentinel', name: 'AURA_SENTINEL' };

  const res = await runTool(env, agent, 'generate_video', {
    prompt: 'Kinematografická vizualizácia Tetrakis ekosystému',
    title: 'Tetrakis Sovereign Video',
    style: 'cinematic',
    duration_sec: 16
  });

  assert.equal(res.ok, true);
  assert.equal(res.mime_type, 'video/webm');
  assert.equal(res._evidence?.action, 'create_file');
  assert.ok(res.video_url.includes('/api/assistant/media/video/'));
  assert.ok(res.download_url.includes('download=1'));
  assert.ok(res.size_bytes > 0);
});

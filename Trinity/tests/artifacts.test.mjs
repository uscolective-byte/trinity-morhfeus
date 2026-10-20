import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  guessContentType,
  sanitizeFilename,
  generateSimplePdf,
  createArtifact,
  createPdfArtifact,
  listArtifacts,
  getArtifact
} from '../src/artifacts.js';
import { runTool, TOOL_HELP, TOOL_SCHEMAS } from '../src/tools.js';
import { READ_TOOLS } from '../src/truth.js';
import { PLUGINS } from '../src/plugins.js';
import { AGENTS } from '../src/registry.js';

function createMockR2() {
  const store = new Map();
  return {
    store,
    async put(key, body, options = {}) {
      let size = 0;
      if (typeof body === 'string') {
        size = new TextEncoder().encode(body).length;
      } else if (body instanceof Uint8Array) {
        size = body.byteLength;
      }
      store.set(key, {
        body,
        size,
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {}
      });
      return { key, size };
    },
    async get(key) {
      const item = store.get(key);
      if (!item) return null;
      return {
        key,
        size: item.size,
        httpMetadata: item.httpMetadata,
        customMetadata: item.customMetadata,
        async text() {
          if (typeof item.body === 'string') return item.body;
          return new TextDecoder().decode(item.body);
        },
        async arrayBuffer() {
          if (item.body instanceof Uint8Array) return item.body.buffer;
          return new TextEncoder().encode(item.body).buffer;
        },
        writeHttpMetadata(headers) {
          if (item.httpMetadata?.contentType) {
            headers.set('Content-Type', item.httpMetadata.contentType);
          }
        }
      };
    }
  };
}

function createMockDB() {
  const artifacts = new Map();
  return {
    artifacts,
    prepare(sql) {
      let params = [];
      return {
        bind(...args) {
          params = args;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO ops_artifacts')) {
            const [id, filename, r2_key, content_type, size_bytes, created_by, notes, created_at] = params;
            artifacts.set(id, { id, filename, r2_key, content_type, size_bytes, created_by, notes, created_at });
            return { success: true };
          }
          return { success: true };
        },
        async first() {
          if (sql.includes('FROM ops_artifacts WHERE id = ?')) {
            return artifacts.get(params[0]) || null;
          }
          if (sql.includes('FROM ops_plugins WHERE id=?')) {
            return { installed: 1, enabled: 1 };
          }
          return null;
        },
        async all() {
          if (sql.includes('FROM ops_artifacts')) {
            return { results: Array.from(artifacts.values()) };
          }
          return { results: [] };
        }
      };
    }
  };
}

test('Artifacts Engine: guessContentType správne deteguje všetky formáty', () => {
  assert.equal(guessContentType('dokument.pdf'), 'application/pdf');
  assert.equal(guessContentType('kod.py'), 'text/x-python; charset=utf-8');
  assert.equal(guessContentType('data.json'), 'application/json; charset=utf-8');
  assert.equal(guessContentType('poznámky.txt'), 'text/plain; charset=utf-8');
  assert.equal(guessContentType('README.md'), 'text/markdown; charset=utf-8');
  assert.equal(guessContentType('skript.js'), 'application/javascript; charset=utf-8');
  assert.equal(guessContentType('app.ts'), 'text/typescript; charset=utf-8');
  assert.equal(guessContentType('stranka.html'), 'text/html; charset=utf-8');
  assert.equal(guessContentType('tabulka.csv'), 'text/csv; charset=utf-8');
  assert.equal(guessContentType('databaza.sql'), 'application/sql; charset=utf-8');
  assert.equal(guessContentType('deploy.sh'), 'application/x-sh; charset=utf-8');
  assert.equal(guessContentType('foto.jpg'), 'image/jpeg');
  assert.equal(guessContentType('logo.png'), 'image/png');
  assert.equal(guessContentType('diagram.svg'), 'image/svg+xml; charset=utf-8');
});

test('Artifacts Engine: sanitizeFilename odstraňuje nebezpečné znaky a path traversal', () => {
  assert.equal(sanitizeFilename('../../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFilename('moj subor (1).pdf'), 'moj_subor__1_.pdf');
});

test('Artifacts Engine: generateSimplePdf vytvorí validnú PDF 1.4 binárku', () => {
  const pdfBytes = generateSimplePdf({
    title: 'Trinity Test Report',
    author: 'Trinity Sentinel',
    content: '# Nadpis 1\nToto je testovaci obsah vytvoreny cez Trinity.\n\n## Sekcia 2\nOverenie viacerych stran a odsekov.'
  });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 500, 'PDF súbor musí mať reálnu veľkosť');

  const text = new TextDecoder('latin1').decode(pdfBytes);
  assert.ok(text.startsWith('%PDF-1.4'), 'PDF musí začínať %PDF-1.4 hlavičkou');
  assert.ok(text.includes('/Type /Catalog'), 'PDF musí obsahovať katalóg');
  assert.ok(text.includes('/Type /Pages'), 'PDF musí obsahovať zoznam strán');
  assert.ok(text.includes('xref'), 'PDF musí obsahovať xref tabuľku');
  assert.ok(text.includes('%%EOF'), 'PDF musí končiť %%EOF značkou');
});

test('Artifacts Engine: createArtifact a createPdfArtifact uložia súbory do R2 a D1', async () => {
  const mockR2 = createMockR2();
  const mockDB = createMockDB();
  const env = { ARTIFACTS: mockR2, DB: mockDB };

  // 1. Vytvorenie Python skriptu (.py)
  const pyResult = await createArtifact(env, {
    filename: 'analyzator.py',
    content: 'import sys\nprint("Hello from Trinity!")\n',
    notes: 'Python skript pre analýzu dát'
  });

  assert.ok(pyResult.id);
  assert.equal(pyResult.filename, 'analyzator.py');
  assert.equal(pyResult.content_type, 'text/x-python; charset=utf-8');
  assert.ok(pyResult.url.startsWith('/api/assistant/files/'));
  assert.ok(pyResult.size_bytes > 0);
  assert.ok(mockR2.store.has(pyResult.path));

  // 2. Vytvorenie JSON súboru (.json)
  const jsonResult = await createArtifact(env, {
    filename: 'konfiguracia.json',
    content: JSON.stringify({ status: 'ok', agents: 45 }, null, 2),
    notes: 'Systémová konfigurácia'
  });
  assert.equal(jsonResult.content_type, 'application/json; charset=utf-8');

  // 3. Vytvorenie PDF dokumentu (.pdf)
  const pdfResult = await createPdfArtifact(env, {
    filename: 'mesacny_report.pdf',
    title: 'Mesačný finančný report',
    content: '# Súhrn ziskov\nCelkový zisk: 12 500 EUR.\n\n## Detaily\nProjekt Trinity funguje stabilne.',
    author: 'Trinity Market Research'
  });

  assert.equal(pdfResult.content_type, 'application/pdf');
  assert.ok(mockR2.store.has(pdfResult.path));

  // 4. Výpis artefaktov cez listArtifacts
  const list = await listArtifacts(env);
  assert.equal(list.length, 3);
  assert.ok(list.some(a => a.filename === 'analyzator.py'));
  assert.ok(list.some(a => a.filename === 'mesacny_report.pdf'));

  // 5. Načítanie artefaktu cez getArtifact
  const loaded = await getArtifact(env, pyResult.id);
  assert.ok(loaded.content.includes('Hello from Trinity!'));
});

test('Artifacts Engine: integrácia nástrojov do runTool a Truth Policy', async () => {
  const mockR2 = createMockR2();
  const mockDB = createMockDB();
  const env = { ARTIFACTS: mockR2, DB: mockDB };
  const orchestrator = AGENTS.find(a => a.id === 'orchestrator');

  // create_file cez runTool
  const fileRes = await runTool(env, orchestrator, 'create_file', {
    filename: 'export_dat.csv',
    content: 'id,meno,hodnota\n1,Alpha,100\n2,Beta,200\n',
    notes: 'Dátový export'
  });

  assert.equal(fileRes.filename, 'export_dat.csv');
  assert.equal(fileRes.content_type, 'text/csv; charset=utf-8');
  assert.equal(fileRes._evidence.effect, 'mutation');
  assert.equal(fileRes._evidence.action, 'create_file');

  // create_pdf cez runTool
  const pdfRes = await runTool(env, orchestrator, 'create_pdf', {
    filename: 'analyza_rizik.pdf',
    title: 'Analýza operačných rizík',
    content: '# Rizikový profil\nVšetky bezpečnostné parametre v norme.'
  });

  assert.equal(pdfRes.filename, 'analyza_rizik.pdf');
  assert.equal(pdfRes._evidence.effect, 'mutation');
  assert.equal(pdfRes._evidence.action, 'create_file');

  // list_artifacts cez runTool
  const listRes = await runTool(env, orchestrator, 'list_artifacts', { limit: 10 });
  assert.ok(listRes.total >= 2);
  assert.equal(listRes._evidence.effect, 'read');

  // read_artifact cez runTool
  const readRes = await runTool(env, orchestrator, 'read_artifact', { id: fileRes.id });
  assert.ok(readRes.content.includes('Alpha'));
  assert.equal(readRes._evidence.effect, 'read');
});

test('Artifacts Engine: Schémy, TOOL_HELP, READ_TOOLS a Plugin konfigurácia', () => {
  const artifactTools = ['create_file', 'create_pdf', 'list_artifacts', 'read_artifact'];

  // Schémy
  for (const t of artifactTools) {
    assert.ok(TOOL_SCHEMAS[t], `Schéma pre ${t} musí existovať v TOOL_SCHEMAS`);
    assert.ok(TOOL_HELP[t], `Popis pre ${t} musí existovať v TOOL_HELP`);
    assert.ok(TOOL_HELP[t].length > 15, `Popis pre ${t} musí byť zmysluplný`);
  }

  // READ_TOOLS
  assert.ok(READ_TOOLS.has('list_artifacts'));
  assert.ok(READ_TOOLS.has('read_artifact'));

  // Plugin artifacts
  const artifactPlugin = PLUGINS.find(p => p.id === 'artifacts');
  assert.ok(artifactPlugin, 'Plugin artifacts musí existovať');
  assert.ok(artifactPlugin.tools.includes('create_file'));
  assert.ok(artifactPlugin.tools.includes('create_pdf'));
  assert.ok(artifactPlugin.tools.includes('list_artifacts'));
  assert.ok(artifactPlugin.tools.includes('read_artifact'));

  // Všetci agenti majú k dispozícii tieto nástroje
  for (const agent of AGENTS) {
    assert.ok(agent.tools.includes('create_file'), `Agent ${agent.id} musí mať prístup ku create_file`);
    assert.ok(agent.tools.includes('create_pdf'), `Agent ${agent.id} musí mať prístup ku create_pdf`);
  }
});

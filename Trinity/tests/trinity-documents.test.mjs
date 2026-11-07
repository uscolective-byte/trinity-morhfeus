import test from 'node:test';
import assert from 'node:assert/strict';
import { listTrinityDocuments, getTrinityDocument, exportTrinityDocument, SEED_COMPLIANCE_DOCUMENTS } from '../src/trinity-documents.js';

test('trinity-documents: SEED_COMPLIANCE_DOCUMENTS obsahuje kompletnú sadu kľúčových dokumentov', () => {
  const ids = SEED_COMPLIANCE_DOCUMENTS.map(d => d.id);
  assert.ok(ids.includes('trinity-gdpr-privacy-consent'), 'Obsahuje GDPR');
  assert.ok(ids.includes('trinity-kompletna-dokumentacia'), 'Obsahuje kompletnú dokumentáciu');
  assert.ok(ids.includes('trinity-omni-dev-studio-sprievodca'), 'Obsahuje Omni-Dev sprievodcu');
  assert.ok(ids.includes('trinity-meta-ai-social-manual'), 'Obsahuje Meta manuál');
  assert.ok(ids.includes('trinity-desatoro-pravdivosti'), 'Obsahuje Desatoro pravdivosti');
  assert.ok(ids.includes('trinity-aktualny-stav-systemu'), 'Obsahuje Aktuálny stav');
  assert.ok(ids.includes('trinity-architektura-20261103'), 'Obsahuje Architektúru 20261103');
  assert.ok(ids.includes('trinity-protokol-369-kvantovy-router'), 'Obsahuje Protokol 3-6-9');
  assert.ok(ids.includes('trinity-team-handoff-ledger'), 'Obsahuje Team Handoff Ledger');
  assert.ok(ids.includes('trinity-jednotna-receipt-architektura'), 'Obsahuje Jednotnú Receipt Architektúru');
});

test('trinity-documents: listTrinityDocuments vracia seed dokumenty aj bez D1/KV', async () => {
  const mockEnv = {};
  const res = await listTrinityDocuments(mockEnv, { limit: 50 });
  assert.ok(Array.isArray(res.items));
  assert.ok(res.items.length >= 10, 'Musí obsahovať minimálne 10 seed dokumentov');
  assert.ok(res.categories.includes('legal_compliance'));
  assert.ok(res.categories.includes('architecture'));
  assert.ok(res.categories.includes('manual_doc'));
  assert.ok(res.categories.includes('workflow_step'));
});

test('trinity-documents: getTrinityDocument nájde seed dokument podľa ID', async () => {
  const mockEnv = {};
  const doc = await getTrinityDocument(mockEnv, 'trinity-kompletna-dokumentacia');
  assert.ok(doc);
  assert.equal(doc.id, 'trinity-kompletna-dokumentacia');
  assert.ok(doc.content.includes('OMNI-CORE'));
  assert.ok(doc.export_md_url);
  assert.ok(doc.export_pdf_url);
});

test('trinity-documents: overenie nových dokumentov naostro do UI', async () => {
  const mockEnv = {};

  // 1. Architektúra 20261103
  const archDoc = await getTrinityDocument(mockEnv, 'trinity-architektura-20261103');
  assert.ok(archDoc, 'Architektúra 20261103 musí existovať');
  assert.equal(archDoc.category, 'architecture');
  assert.ok(archDoc.content.includes('Architektúra Trinity'));
  assert.ok(archDoc.content.includes('Kanonický GitHub'));

  // 2. Kmitočtový Protokol 3-6-9 & Kvantový Router
  const protoDoc = await getTrinityDocument(mockEnv, 'trinity-protokol-369-kvantovy-router');
  assert.ok(protoDoc, 'Protokol 3-6-9 musí existovať');
  assert.equal(protoDoc.category, 'architecture');
  assert.ok(protoDoc.content.includes('Vlnová Funkcia Zámeru'));
  assert.ok(protoDoc.content.includes('Entanglement Synchronizácia'));

  // 3. Team Handoff Ledger
  const teamDoc = await getTrinityDocument(mockEnv, 'trinity-team-handoff-ledger');
  assert.ok(teamDoc, 'Team Handoff Ledger musí existovať');
  assert.equal(teamDoc.category, 'workflow_step');
  assert.ok(teamDoc.content.includes('Codex & Antigravity'));
  assert.ok(teamDoc.content.includes('PR #35'));

  // 4. Jednotná Receipt Architektúra
  const receiptDoc = await getTrinityDocument(mockEnv, 'trinity-jednotna-receipt-architektura');
  assert.ok(receiptDoc, 'Jednotná Receipt Architektúra musí existovať');
  assert.equal(receiptDoc.category, 'architecture');
  assert.ok(receiptDoc.content.includes('Jednotná Receipt Architektúra'));
  assert.ok(receiptDoc.content.includes('Sovereign Ledger'));
  assert.ok(receiptDoc.content.includes('executeVerifiedFileCreation'));

});

test('trinity-documents: exportTrinityDocument exportuje .md a .pdf pre nové dokumenty', async () => {
  const mockEnv = {};
  const protoDoc = await getTrinityDocument(mockEnv, 'trinity-protokol-369-kvantovy-router');

  // Export MD
  const mdExport = exportTrinityDocument(protoDoc, 'md');
  assert.equal(mdExport.contentType, 'text/markdown; charset=utf-8');
  assert.ok(mdExport.filename.endsWith('.md'));
  assert.ok(mdExport.body.includes('Kmitočtový Protokol 3-6-9'));

  // Export PDF
  const pdfExport = exportTrinityDocument(protoDoc, 'pdf');
  assert.equal(pdfExport.contentType, 'application/pdf');
  assert.ok(pdfExport.filename.endsWith('.pdf'));
  assert.ok(pdfExport.body);
});

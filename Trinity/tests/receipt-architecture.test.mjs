import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UnifiedReceiptSchema,
  ResonanceReceiptExtensionSchema,
  buildReceipt,
  hashPayload,
  executeVerifiedFileCreation
} from '../src/receipt.js';

test('1. Git receipt spĺňa schému a overuje commit evidence', () => {
  const receipt = buildReceipt({
    tool: 'git_commit',
    action: 'commit',
    status: 'success',
    actor: { type: 'agent', id: 'trinity-coder' },
    evidence: [
      {
        type: 'git',
        id: '2fd75ce',
        description: 'Commit created',
        afterHash: '2fd75ce'
      }
    ]
  });

  const parsed = UnifiedReceiptSchema.parse(receipt);
  assert.equal(parsed.tool, 'git_commit');
  assert.equal(parsed.action, 'commit');
  assert.equal(parsed.status, 'success');
  assert.equal(parsed.evidence[0].type, 'git');
});

test('2. File receipt zaznamená vytvorenie súboru a SHA-256 hash', () => {
  const content = 'export function quantumRouter() {}';
  const fileHash = hashPayload(content);

  const receipt = buildReceipt({
    tool: 'write_file',
    action: 'create',
    status: 'success',
    target: {
      type: 'file',
      id: 'src/routing/quantum-router.ts'
    },
    evidence: [
      {
        type: 'file',
        id: 'src/routing/quantum-router.ts',
        description: 'Created router file',
        afterHash: fileHash
      }
    ]
  });

  const parsed = UnifiedReceiptSchema.parse(receipt);
  assert.equal(parsed.target.type, 'file');
  assert.ok(parsed.evidence[0].afterHash.startsWith('sha256:'));
});

test('3. Trinity Docs receipt zaznamená vytvorenie dokumentu', () => {
  const receipt = buildReceipt({
    tool: 'trinity_doc_create',
    action: 'create_document',
    status: 'success',
    target: {
      type: 'document',
      id: 'quantum-resonance-config'
    },
    evidence: [
      {
        type: 'document',
        id: 'doc_8931',
        description: 'Quantum resonance config created'
      }
    ]
  });

  const parsed = UnifiedReceiptSchema.parse(receipt);
  assert.equal(parsed.target.id, 'quantum-resonance-config');
  assert.equal(parsed.evidence[0].id, 'doc_8931');
});

test('4. MCP receipt obsahuje metrics s latenciou a počtom nástrojov', () => {
  const receipt = buildReceipt({
    tool: 'mcp_call',
    action: 'tools/list',
    status: 'success',
    evidence: [
      {
        type: 'api',
        id: 'trinity-local',
        description: 'Local stdio MCP tools list'
      }
    ],
    metrics: {
      latencyMs: 57,
      toolCount: 3
    }
  });

  const parsed = UnifiedReceiptSchema.parse(receipt);
  assert.equal(parsed.metrics.latencyMs, 57);
  assert.equal(parsed.metrics.toolCount, 3);
});

test('5. HTTP receipt obsahuje sieťové metriky a URI', () => {
  const receipt = buildReceipt({
    tool: 'http',
    action: 'GET',
    status: 'success',
    evidence: [
      {
        type: 'http',
        id: 'https://auru.space/mcp',
        uri: 'https://auru.space/mcp',
        description: 'Remote MCP endpoint probe'
      }
    ],
    metrics: {
      statusCode: 200,
      latencyMs: 152
    }
  });

  const parsed = UnifiedReceiptSchema.parse(receipt);
  assert.equal(parsed.metrics.statusCode, 200);
});

test('6. Database receipt eviduje D1 zápis a riadok', () => {
  const receipt = buildReceipt({
    tool: 'd1',
    action: 'insert',
    status: 'success',
    target: {
      type: 'table',
      id: 'memory_entries'
    },
    evidence: [
      {
        type: 'database',
        id: 'row:1452',
        description: 'Inserted long term memory node'
      }
    ]
  });

  const parsed = UnifiedReceiptSchema.parse(receipt);
  assert.equal(parsed.target.id, 'memory_entries');
  assert.equal(parsed.evidence[0].id, 'row:1452');
});

test('7. Test receipt zaznamenáva výsledky test runnera', () => {
  const receipt = buildReceipt({
    tool: 'test_runner',
    action: 'integration',
    status: 'success',
    evidence: [
      {
        type: 'test',
        id: 'suite:all',
        description: 'Targeted integration test suite'
      }
    ],
    metrics: {
      passed: 19,
      failed: 0
    }
  });

  const parsed = UnifiedReceiptSchema.parse(receipt);
  assert.equal(parsed.metrics.passed, 19);
  assert.equal(parsed.metrics.failed, 0);
});

test('8. UI receipt dokumentuje publikovanie v rozhraní', () => {
  const receipt = buildReceipt({
    tool: 'ui_publish',
    action: 'deploy_docs',
    status: 'success',
    target: {
      type: 'route',
      id: '/docs/architecture'
    },
    evidence: [
      {
        type: 'ui',
        id: 'route:/docs/architecture',
        description: 'Documentation page rendered live in UI'
      }
    ]
  });

  const parsed = UnifiedReceiptSchema.parse(receipt);
  assert.equal(parsed.target.id, '/docs/architecture');
});

test('9. Workflow Chain prepája kroky cez parentReceiptId', () => {
  const r1 = buildReceipt({ tool: 'planner', action: 'plan', status: 'success' });
  const r2 = buildReceipt({ tool: 'write_file', action: 'write', status: 'success', parentReceiptId: r1.receiptId });
  const r3 = buildReceipt({ tool: 'test_runner', action: 'test', status: 'success', parentReceiptId: r2.receiptId });

  assert.equal(r2.parentReceiptId, r1.receiptId);
  assert.equal(r3.parentReceiptId, r2.receiptId);
});

test('10. 3-6-9 Resonance Receipt Extension spĺňa kmitočtovú štruktúru', () => {
  const resonanceExtension = {
    thesis: {
      intent: 'refactor_router',
      confidence: 0.92
    },
    transform: {
      guardianPassed: true,
      toolsSelected: ['project_inspect', 'write_file', 'test_runner']
    },
    synthesis: {
      outputHash: 'sha256:4f8392104829abcd7258866350066fe19a344572bee0ccd9a9aab08d13c890f8',
      persisted: true
    }
  };

  const parsed = ResonanceReceiptExtensionSchema.parse(resonanceExtension);
  assert.equal(parsed.thesis.intent, 'refactor_router');
  assert.equal(parsed.transform.guardianPassed, true);
  assert.equal(parsed.synthesis.persisted, true);
});

test('11. Implementačné kritérium 1: vytvorenie súboru, výpočet hashu, nezávislé overenie a zápis do Sovereign Ledgeru', async () => {
  const tempDir = path.resolve(fileURLToPath(new URL('../workspace/receipt-test', import.meta.url)));
  const fileName = 'verified-evidence-doc.txt';
  const content = 'KRYPTOGRAFICKÝ DÔKAZ TRINITY: Každá akcia = Receipt = Overiteľný dôkaz.';

  try {
    const outcome = await executeVerifiedFileCreation({
      targetDir: tempDir,
      fileName,
      content,
      actor: { type: 'agent', id: 'trinity-evidence-engine' }
    });

    // Overenie návratového stavu
    assert.equal(outcome.status, 'SUCCESS');
    assert.ok(outcome.receipt.receiptId.startsWith('RCP-'));
    assert.ok(outcome.sha256.startsWith('sha256:'));
    assert.ok(outcome.ledgerProof.hash.length >= 64);

    // Nezávislé overenie, že súbor reálne existuje na disku
    assert.ok(fs.existsSync(outcome.verifiedFile));
    const directRead = fs.readFileSync(outcome.verifiedFile, 'utf8');
    assert.equal(directRead, content);

    // Nezávislé overenie, že záznam bol zapísaný do lokálneho Sovereign Ledgeru
    const ledgerPath = path.join(tempDir, 'sovereign-receipt-ledger.jsonl');
    assert.ok(fs.existsSync(ledgerPath));
    const ledgerLines = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/);
    const lastLedgerEntry = JSON.parse(ledgerLines[ledgerLines.length - 1]);
    assert.equal(lastLedgerEntry.receiptId, outcome.receipt.receiptId);
    assert.equal(lastLedgerEntry.evidence[0].afterHash, outcome.sha256);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

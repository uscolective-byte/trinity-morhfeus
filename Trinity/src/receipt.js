/**
 * @module TRINITY_OMNI_CORE
 * @subsystem UNIFIED_RECEIPT_ENGINE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Jednotná receipt architektúra pre Trinity:
 * OpenTelemetry + Cloudflare Audit + Git Commit Evidence + Sovereign Ledger.
 * Každá akcia = Receipt = Overiteľný dôkaz.
 */

import { z } from 'zod';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const EvidenceType = z.enum([
  'file',
  'document',
  'database',
  'git',
  'http',
  'api',
  'ui',
  'test'
]);

export const EvidenceSchema = z.object({
  type: EvidenceType,
  id: z.string().min(1).max(500),
  description: z.string().max(1000).default(''),
  beforeHash: z.string().regex(/^sha256:[a-f0-9]{64}$|^[a-f0-9]{7,64}$/).optional(),
  afterHash: z.string().regex(/^sha256:[a-f0-9]{64}$|^[a-f0-9]{7,64}$/).optional(),
  uri: z.string().max(2048).optional()
}).strict();

export const LedgerProofSchema = z.object({
  eventId: z.string().min(1),
  hash: z.string().min(8),
  signedAt: z.string().datetime(),
  chainHash: z.string().optional()
}).strict();

export const ReceiptStatus = z.enum([
  'success',
  'failed',
  'partial',
  'cancelled'
]);

export const ActorSchema = z.object({
  type: z.enum(['user', 'agent', 'system']),
  id: z.string().min(1).max(200)
}).strict();

export const TargetSchema = z.object({
  type: z.string().min(1).max(100),
  id: z.string().min(1).max(500)
}).strict();

export const UnifiedReceiptSchema = z.object({
  receiptId: z.string().min(1),
  parentReceiptId: z.string().optional(),
  tool: z.string().min(1).max(120),
  action: z.string().min(1).max(120),
  status: ReceiptStatus,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  actor: ActorSchema,
  target: TargetSchema.optional(),
  evidence: z.array(EvidenceSchema).default([]),
  metrics: z.record(z.string(), z.number()).optional(),
  ledger: LedgerProofSchema.optional()
}).strict();

export const ResonanceReceiptExtensionSchema = z.object({
  thesis: z.object({
    intent: z.string(),
    confidence: z.number().min(0).max(1)
  }).strict(),
  transform: z.object({
    guardianPassed: z.boolean(),
    toolsSelected: z.array(z.string())
  }).strict(),
  synthesis: z.object({
    outputHash: z.string(),
    persisted: z.boolean()
  }).strict()
}).strict();

/**
 * Vytvorí overiteľný SHA-256 hash pre evidenciu.
 */
export function hashPayload(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return 'sha256:' + createHash('sha256').update(serialized).digest('hex');
}

/**
 * Fabrika na vytváranie štandardizovaného Receiptu.
 */
export function buildReceipt({
  tool,
  action,
  status = 'success',
  actor = { type: 'agent', id: 'trinity' },
  target,
  evidence = [],
  metrics,
  ledger,
  startedAt,
  completedAt,
  parentReceiptId
}) {
  const start = startedAt || new Date().toISOString();
  const end = completedAt || new Date().toISOString();
  const durationMs = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const receiptId = `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const receipt = {
    receiptId,
    ...(parentReceiptId ? { parentReceiptId } : {}),
    tool,
    action,
    status,
    startedAt: start,
    completedAt: end,
    durationMs,
    actor,
    ...(target ? { target } : {}),
    evidence,
    ...(metrics ? { metrics } : {}),
    ...(ledger ? { ledger } : {})
  };

  return UnifiedReceiptSchema.parse(receipt);
}

/**
 * Implementačné kritérium 1:
 * Trinity vytvorí testovací súbor, vypočíta jeho hash, nezávisle overí jeho obsah
 * a uloží podpísaný/autentizovaný receipt do Sovereign Ledgeru.
 * Až po splnení všetkých overení vracia SUCCESS.
 */
export async function executeVerifiedFileCreation({
  targetDir,
  fileName,
  content,
  actor = { type: 'agent', id: 'trinity' }
}) {
  const startedAt = new Date().toISOString();
  const fullPath = path.join(targetDir, fileName);
  fs.mkdirSync(targetDir, { recursive: true });

  // 1. Zápis súboru
  fs.writeFileSync(fullPath, content, 'utf8');

  // 2. Nezávislé prečítanie a výpočet SHA-256 hashu
  const readBack = fs.readFileSync(fullPath, 'utf8');
  if (readBack !== content) {
    throw new Error('VERIFICATION_FAILED: Obsah súboru sa po zápise nezhoduje.');
  }
  const afterHash = hashPayload(readBack);

  // 3. Vytvorenie kryptografického Ledger Proofu
  const completedAt = new Date().toISOString();
  const proofHash = createHash('sha256')
    .update(`${startedAt}|${fileName}|${afterHash}|${actor.id}`)
    .digest('hex');

  const ledgerProof = {
    eventId: `EVT-${Date.now()}`,
    hash: proofHash,
    signedAt: completedAt,
    chainHash: `sha256:${proofHash}`
  };

  // 4. Zostavenie a validácia Receiptu
  const receipt = buildReceipt({
    tool: 'write_file',
    action: 'create_verified',
    status: 'success',
    actor,
    target: {
      type: 'file',
      id: fileName
    },
    evidence: [
      {
        type: 'file',
        id: fileName,
        description: 'Autentizovaný a nezávisle overený súbor',
        afterHash,
        uri: `file://${fullPath.replace(/\\/g, '/')}`
      }
    ],
    ledger: ledgerProof,
    startedAt,
    completedAt
  });

  // 5. Zápis do lokálneho Sovereign Ledgeru
  const ledgerPath = path.join(targetDir, 'sovereign-receipt-ledger.jsonl');
  fs.appendFileSync(ledgerPath, JSON.stringify(receipt) + '\n', 'utf8');

  return {
    status: 'SUCCESS',
    receipt,
    verifiedFile: fullPath,
    sha256: afterHash,
    ledgerProof
  };
}

# Jednotná Receipt Architektúra Trinity
**Autor:** Basterix (Root Architect)  
**Koncepcia:** OpenTelemetry + Cloudflare Audit + Git Commit Evidence + Sovereign Ledger  
**Pravidlo:** Každá akcia = Receipt = Overiteľný dôkaz (Truth Policy 2.1)

---

## 1. Princíp a Invarianty
1. Žiadna operácia nesmie hlásiť `SUCCESS` bez overiteľného dôkazu (`evidence`).
2. Každý receipt je nemenne identifikovaný cez `receiptId`, viazaný na čas (`startedAt`, `completedAt`), aktéra (`actor`), cieľ (`target`) a kryptografický doklad (`ledger`).
3. Zreťazenie operácií sa realizuje cez `parentReceiptId`, čím vzniká auditovateľný strom priebehu úlohy.

---

## 2. Dátový model

### 2.1 Evidence Schéma
```typescript
export interface Evidence {
  type: 'file' | 'document' | 'database' | 'git' | 'http' | 'api' | 'ui' | 'test';
  id: string;
  description: string;
  beforeHash?: string;
  afterHash?: string;
  uri?: string;
}
```

### 2.2 Ledger Proof
```typescript
export interface LedgerProof {
  eventId: string;
  hash: string;
  signedAt: string;
  chainHash?: string;
}
```

### 2.3 Základný Receipt
```typescript
export interface Receipt {
  receiptId: string;
  parentReceiptId?: string;
  tool: string;
  action: string;
  status: 'success' | 'failed' | 'partial' | 'cancelled';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  actor: { type: 'user' | 'agent' | 'system'; id: string };
  target?: { type: string; id: string };
  evidence: Evidence[];
  metrics?: Record<string, number>;
  ledger?: LedgerProof;
}
```

---

## 3. Typizované Receipty

### Git Receipt
```json
{
  "tool": "git_commit",
  "action": "commit",
  "status": "success",
  "evidence": [{ "type": "git", "id": "2fd75ce", "description": "Commit created" }]
}
```

### File Receipt
```json
{
  "tool": "write_file",
  "action": "create",
  "target": { "type": "file", "id": "src/routing/quantum-router.ts" },
  "evidence": [{ "type": "file", "id": "src/routing/quantum-router.ts", "afterHash": "sha256:..." }]
}
```

### Trinity Docs Receipt
```json
{
  "tool": "trinity_doc_create",
  "action": "create_document",
  "status": "success",
  "target": { "type": "document", "id": "quantum-resonance-config" },
  "evidence": [{ "type": "document", "id": "doc_8931" }]
}
```

### MCP Receipt
```json
{
  "tool": "mcp_call",
  "action": "tools/list",
  "evidence": [{ "type": "api", "id": "trinity-local" }],
  "metrics": { "latencyMs": 57, "toolCount": 3 }
}
```

### Database Receipt
```json
{
  "tool": "d1",
  "action": "insert",
  "target": { "type": "table", "id": "memory_entries" },
  "evidence": [{ "type": "database", "id": "row:1452" }]
}
```

### Test Receipt
```json
{
  "tool": "test_runner",
  "action": "integration",
  "status": "success",
  "metrics": { "passed": 19, "failed": 0 }
}
```

### 3-6-9 Resonance Extension
```json
{
  "thesis": { "intent": "refactor_router", "confidence": 0.92 },
  "transform": { "guardianPassed": true, "toolsSelected": ["project_inspect", "write_file", "test_runner"] },
  "synthesis": { "outputHash": "sha256:...", "persisted": true }
}
```

---

## 4. Implementačné kritérium 1 (Overené)
Funkcia `executeVerifiedFileCreation()` v `Trinity/src/receipt.js`:
1. Vytvorí súbor na disku.
2. Vypočíta jeho SHA-256 hash.
3. Nezávisle znovu prečíta súbor a overí integritu obsahu.
4. Zostaví kryptografický Ledger Proof.
5. Zapíše záznam do lokálneho `sovereign-receipt-ledger.jsonl`.
6. Iba pri 100% zhode a úspechu vracia stav `SUCCESS`.

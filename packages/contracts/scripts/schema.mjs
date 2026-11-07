import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import { MessageSchema, ReceiptSchema } from '../src/tap.js';
for (const [name, schema] of [['tap-v1', MessageSchema], ['receipt-v1', ReceiptSchema]]) {
  const document = z.toJSONSchema(schema);
  if (name === 'tap-v1') {
    // Zod refinements are not emitted by toJSONSchema. Express portable field-local
    // invariants here; cross-field identity/hash checks still require verifyReceipt.
    document.allOf = [
      { if: { properties: { kind: { const: 'task.request' } }, required: ['kind'] },
        then: { properties: { status: { const: 'REQUESTED' }, result: { type: 'null' }, error: { type: 'null' }, evidence: { maxItems: 0 } } } },
      { if: { properties: { status: { const: 'VERIFIED' } }, required: ['status'] },
        then: { properties: { evidence: { minItems: 1 }, error: { type: 'null' } } } }
    ];
  }
  const content = JSON.stringify(document, null, 2) + '\n';
  const path = new URL(`../schema/${name}.json`, import.meta.url);
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')).replace(/\r\n/g, '\n') !== content) throw new Error(`Schema drift: ${name}`);
  } else await writeFile(path, content);
}

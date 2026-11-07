/** Local D1/R2 emulator only. No network provider, HTTP route, credentials or deployment. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { executeTapTask } from '../../src/tap-runtime.js';
import { fromLegacy, verifyReceipt, canonicalJson } from '../../../packages/contracts/src/tap.js';

if (!process.argv[2]) throw new Error('Supply a local output directory as the first argument.');
const destination = resolve(process.argv[2]);
const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default { fetch() { return new Response("local fixture"); } };',
  compatibilityDate: '2026-10-01', d1Databases: { TAP_DB: 'local-proof-db' }, r2Buckets: { TAP_ARTIFACTS: 'local-proof-r2' }
}));
try {
  const db = await mf.getD1Database('TAP_DB'), bucket = await mf.getR2Bucket('TAP_ARTIFACTS');
  const sql = await readFile(new URL('./tap-foundation.sql', import.meta.url), 'utf8');
  for (const statement of sql.replace(/--[^\n]*/g, '').split(';').filter(s => s.trim())) await db.prepare(statement).run();
  const request = fromLegacy({ agent_id: 'orchestrator', tool_id: 'diagnostic_ping', arguments: { message: 'TRINITY OMNI12 local Foundation proof' } }, {
    sender_id: 'orchestrator', environment: 'local', authorization_ref: 'local-fixture-grant', idempotency_key: crypto.randomUUID()
  });
  const context = { principal: { authenticated: true, agent_id: 'orchestrator' }, environment: 'local',
    grant: { subject_id: 'orchestrator', receiver_id: 'orchestrator', environment: 'local', authorization_ref: request.authorization_ref,
      expires_at: Date.now() + 60000, scopes: ['tool:diagnostic_ping'] } };
  const env = { TAP_DB: db, TAP_ARTIFACTS: bucket };
  const outcome = await executeTapTask(env, request, context);
  if (outcome.status !== 'VERIFIED') throw new Error(JSON.stringify(outcome.error));
  const receiptRow = await db.prepare('SELECT artifact_key FROM tap_evidence_receipts WHERE run_id=?').bind(request.run_id).first();
  const receipt = JSON.parse(await (await bucket.get(receiptRow.artifact_key)).text());
  if (!await verifyReceipt(receipt, request, outcome.result)) throw new Error('Local proof readback mismatch');
  const replay = await executeTapTask(env, request, context);
  const audit = (await db.prepare('SELECT * FROM tap_audit_events WHERE run_id=? ORDER BY id').bind(request.run_id).all()).results;
  const summary = { verification_scope: 'LOCAL_MINIFLARE_D1_R2', live_cloud_storage: false,
    external_agent_connection: false, deployment_performed: false,
    task_id: request.task_id, run_id: request.run_id, status: outcome.status, checksum: receipt.checksum,
    readback_verified: true, idempotent_replay: canonicalJson(replay) === canonicalJson(outcome),
    running_event_count: audit.filter(e => e.status === 'RUNNING').length, artifact_key: receiptRow.artifact_key };
  if (!summary.idempotent_replay || summary.running_event_count !== 1) throw new Error('Local proof idempotency failed');
  await mkdir(destination, { recursive: true });
  for (const [file, data] of Object.entries({ request, outcome, receipt, audit, summary })) {
    await writeFile(resolve(destination, `${file}.json`), JSON.stringify(data, null, 2) + '\n');
  }
  console.log(JSON.stringify(summary, null, 2));
} finally { await mf.dispose(); }

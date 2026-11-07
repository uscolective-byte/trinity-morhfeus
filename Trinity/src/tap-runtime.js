/** Scoped Foundation facade. Only the existing diagnostic tool is eligible for activation. */
import { MessageSchema, canonicalJson, createReceipt, digest, transition, verifyReceipt } from '../../packages/contracts/src/tap.js';
import { runTool, TOOL_SCHEMAS } from './tools.js';
import { agentById } from './registry.js';

export const TAP_AGENTS = Object.freeze({
  orchestrator: Object.freeze({ agent_id: 'orchestrator', scopes: Object.freeze(['tool:diagnostic_ping']), environments: Object.freeze(['local', 'staging', 'production']) }),
  'auru-dev-agent': Object.freeze({ agent_id: 'auru-dev-agent', source: 'https://auru.dev', owner_reported_provider: 'Meta AI',
    availability: 'NOT_TESTED', protocol: 'UNVERIFIED', scopes: Object.freeze([]), environments: Object.freeze(['staging']),
    verified_capabilities: Object.freeze([]), transport: null })
});

export class TapError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function requireValue(value, code) { if (!value) throw new TapError(code); }
function checked(result) { requireValue(result?.success === true, 'TAP_STORAGE_FAILURE'); return result; }
function response(request, status, { result = null, evidence = [], error = null } = {}) {
  return MessageSchema.parse({ ...request, kind: 'task.result', status, result, evidence, error });
}
function uncertain(request) {
  return response(request, 'UNKNOWN_OUTCOME', { error: { code: 'TAP_RECONCILIATION_REQUIRED', message: 'Execution or durable evidence is uncertain; do not retry automatically.' } });
}

// Only server-authenticated callers may construct context/grant. Never spread JSON body into it.
function authorize(request, context, env) {
  requireValue(context?.principal?.authenticated === true, 'TAP_IDENTITY_REQUIRED');
  requireValue(context.principal.agent_id === request.sender.id, 'TAP_IDENTITY_MISMATCH');
  requireValue(request.sender.type === 'agent' && request.receiver.type === 'agent', 'TAP_AGENT_REQUIRED');
  const allowedEnvironment = ['local', 'staging'].includes(context.environment)
    || context.environment === 'production' && env.TRINITY_TAP_PRODUCTION === 'diagnostic-only';
  requireValue(allowedEnvironment && request.environment === context.environment, 'TAP_ENVIRONMENT_DENIED');
  const grant = context.grant;
  requireValue(grant && grant.subject_id === request.sender.id && grant.receiver_id === request.receiver.id
    && grant.environment === request.environment && grant.authorization_ref === request.authorization_ref
    && Number.isFinite(grant.expires_at) && grant.expires_at > Date.now(), 'TAP_GRANT_REQUIRED');
  const role = TAP_AGENTS[request.receiver.id];
  const scope = `tool:${request.payload.tool_id}`;
  requireValue(role?.environments.includes(request.environment) && role.scopes.includes(scope) && grant.scopes?.includes(scope), 'TAP_SCOPE_DENIED');
  // New tools need their own independent acceptance verifier before enabling them here.
  requireValue(request.payload.tool_id === 'diagnostic_ping', 'TAP_TOOL_NOT_ENABLED');
  // Foundation verifies the diagnostic contract only, never arbitrary natural-language goals.
  requireValue(request.payload.constraints.length === 0 && request.payload.acceptance_criteria.length === 0, 'TAP_UNSUPPORTED_ACCEPTANCE_CRITERIA');
  TOOL_SCHEMAS.diagnostic_ping.parse(request.payload.arguments);
}

export class TapStore {
  constructor(db, artifacts) { this.db = db; this.artifacts = artifacts; }
  async claim(m, requestHash) {
    const insert = checked(await this.db.prepare(`INSERT OR IGNORE INTO tap_runs
      (run_id,task_id,environment,sender_id,agent_id,idempotency_key,request_hash,status)
      VALUES (?,?,?,?,?,?,?,'REQUESTED')`).bind(m.run_id, m.task_id, m.environment, m.sender.id, m.receiver.id, m.idempotency_key, requestHash).run());
    const row = await this.db.prepare('SELECT * FROM tap_runs WHERE environment=? AND sender_id=? AND idempotency_key=?')
      .bind(m.environment, m.sender.id, m.idempotency_key).first();
    requireValue(row && row.request_hash === requestHash && row.run_id === m.run_id, 'TAP_IDEMPOTENCY_CONFLICT');
    return { fresh: insert.meta?.changes === 1, row };
  }
  async advance(m, from, to, code = null, outcome = null) {
    transition(from, to);
    const results = await this.db.batch([
      this.db.prepare('UPDATE tap_runs SET status=?,response_json=? WHERE run_id=? AND status=?')
        .bind(to, outcome ? canonicalJson(outcome) : null, m.run_id, from),
      this.db.prepare(`INSERT INTO tap_audit_events(run_id,task_id,agent_id,tool_id,environment,status,error_code,created_at)
        SELECT ?,?,?,?,?,?,?,? WHERE changes()=1`).bind(m.run_id, m.task_id, m.receiver.id, m.payload.tool_id, m.environment, to, code, new Date().toISOString())
    ]);
    results.forEach(checked);
    requireValue(results[0].meta?.changes === 1 && results[1].meta?.changes === 1, 'TAP_STATE_CONFLICT');
  }
  async saveReceipt(m, result, receipt) {
    const key = `artifacts/evidence/${m.environment}/${m.run_id}/${receipt.receipt_id}.json`;
    // Conditional R2 write prevents accidental replacement of an existing receipt.
    const put = await this.artifacts.put(key, canonicalJson(receipt), {
      onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' }
    });
    requireValue(put, 'TAP_EVIDENCE_WRITE_FAILED');
    const object = await this.artifacts.get(key);
    requireValue(object, 'TAP_EVIDENCE_MISSING');
    const stored = JSON.parse(await object.text());
    requireValue(await verifyReceipt(stored, m, result), 'TAP_EVIDENCE_MISMATCH');
    checked(await this.db.prepare(`INSERT INTO tap_evidence_receipts(receipt_id,run_id,task_id,artifact_key,checksum,receipt_json)
      VALUES(?,?,?,?,?,?)`).bind(receipt.receipt_id, m.run_id, m.task_id, key, receipt.checksum, canonicalJson(receipt)).run());
    const row = await this.db.prepare('SELECT receipt_json,artifact_key FROM tap_evidence_receipts WHERE receipt_id=?').bind(receipt.receipt_id).first();
    requireValue(row?.artifact_key === key && await verifyReceipt(JSON.parse(row.receipt_json), m, result), 'TAP_EVIDENCE_MISMATCH');
  }
  async verifyStored(m, outcome) {
    if (outcome.evidence.length !== 1) return false;
    const receipt = outcome.evidence[0];
    const row = await this.db.prepare('SELECT receipt_json,artifact_key FROM tap_evidence_receipts WHERE receipt_id=?').bind(receipt.receipt_id).first();
    if (!row || canonicalJson(JSON.parse(row.receipt_json)) !== canonicalJson(receipt)) return false;
    const object = await this.artifacts.get(row.artifact_key);
    return !!object && canonicalJson(JSON.parse(await object.text())) === canonicalJson(receipt)
      && await verifyReceipt(receipt, m, outcome.result);
  }
}

function verifyPing(m, result) {
  const normalized = TOOL_SCHEMAS.diagnostic_ping.parse(m.payload.arguments);
  requireValue(result?.status === 'healthy' && result.tool === 'diagnostic_ping'
    && result.echo === (normalized.message || 'ping')
    && canonicalJson(result.input) === canonicalJson(normalized)
    && result.executor === 'trinity-tool-executor'
    && typeof result.receipt_id === 'string' && result.receipt_id.startsWith('DIAG-RCPT-')
    && result._evidence?.receipt_id === result.receipt_id
    && Number.isFinite(Date.parse(result.executed_at)), 'TAP_ACCEPTANCE_FAILED');
}

/**
 * Reuses legacy Registry -> runTool -> diagnostic_ping, then durable Guardian evidence gate.
 * TAP_DB and TAP_ARTIFACTS must be dedicated, isolated bindings supplied by a future approved host.
 * A retained RUNNING/COMPLETED row is never taken over automatically after interruption.
 */
export async function executeTapTask(env, input, context) {
  const m = MessageSchema.parse(input);
  requireValue(m.kind === 'task.request', 'TAP_REQUEST_REQUIRED');
  requireValue(canonicalJson(m).length <= 32768, 'TAP_MESSAGE_TOO_LARGE');
  authorize(m, context, env);
  requireValue(env.TAP_DB && env.TAP_ARTIFACTS, 'TAP_ISOLATED_STORAGE_REQUIRED');
  const store = new TapStore(env.TAP_DB, env.TAP_ARTIFACTS);
  const { fresh, row } = await store.claim(m, await digest(m));
  if (!fresh) {
    if (!row.response_json) return uncertain(m);
    try {
      const outcome = MessageSchema.parse(JSON.parse(row.response_json));
      // Persisted result must be bound to this exact request, including its routing metadata.
      requireValue(canonicalJson({ ...outcome, kind: m.kind, status: m.status, result: null, evidence: [], error: null }) === canonicalJson(m), 'TAP_REPLAY_MISMATCH');
      if (outcome.status === 'VERIFIED' && !await store.verifyStored(m, outcome)) return uncertain(m);
      requireValue(outcome.status === row.status, 'TAP_REPLAY_MISMATCH');
      return outcome;
    } catch { return uncertain(m); }
  }
  let state = 'REQUESTED';
  let started = false;
  try {
    await store.advance(m, state, 'QUEUED'); state = 'QUEUED';
    await store.advance(m, state, 'RUNNING'); state = 'RUNNING';
    const agent = agentById(m.receiver.id);
    requireValue(agent?.tools.includes(m.payload.tool_id), 'TAP_LEGACY_AGENT_MISSING');
    started = true;
    // Never inherit legacy DB/service/secret bindings from the hosting runtime.
    // Optional legacy ops_events is isolated too; the TAP audit below is mandatory.
    const result = await runTool({ DB: env.TAP_DB }, agent, m.payload.tool_id, m.payload.arguments);
    verifyPing(m, result);
    await store.advance(m, state, 'COMPLETED'); state = 'COMPLETED';
    const receipt = await createReceipt(m, result);
    await store.saveReceipt(m, result, receipt);
    const outcome = response(m, 'VERIFIED', { result, evidence: [receipt] });
    await store.advance(m, state, 'VERIFIED', null, outcome);
    return outcome;
  } catch (error) {
    // Exception text may contain credentials or provider bodies: persist only controlled error codes.
    const code = error instanceof TapError ? error.code : 'TAP_EXECUTION_OR_STORAGE_FAILURE';
    const status = started ? (code === 'TAP_ACCEPTANCE_FAILED' ? 'FAILED' : 'UNKNOWN_OUTCOME') : 'FAILED';
    const outcome = response(m, status, { error: { code, message: status === 'UNKNOWN_OUTCOME'
      ? 'Execution or durable evidence is uncertain; do not retry automatically.' : 'Task did not meet the execution contract.' } });
    if (state === 'RUNNING' || state === 'COMPLETED') {
      try { await store.advance(m, state, status, code, outcome); }
      catch { return uncertain(m); }
    }
    return outcome;
  }
}

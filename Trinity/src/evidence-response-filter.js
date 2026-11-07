/**
 * Server-side gate for system action replies. Never pass model-created adapters.
 * The host supplies authenticated receipt lookup, independent state verification
 * and durable append-only audit. This module does not execute the action.
 */
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const messages = Object.freeze({
  verified: 'Operácia bola vykonaná a jej výsledok bol nezávisle overený.',
  blocked: 'Nemám overený systémový dôkaz, že akcia bola vykonaná.',
  unknown: 'Výsledok operácie nie je overený. Pred opakovaním skontroluj jej stav.',
  failed: 'Operácia zlyhala podľa systémového potvrdenia.',
  pending: 'Operácia ešte nie je dokončená.',
  denied: 'Operácia zlyhala: Prístup bol odmietnutý.',
  unavailable: 'Tento príkaz nedokážem vykonať: chýba schopnosť alebo povinný parameter.',
  audit: 'Výsledok nemožno potvrdiť: zápis do auditného denníka zlyhal.'
});

function requestValid(request) {
  return request && ['runId', 'operationId', 'action', 'target', 'receiptId']
    .every(key => nonempty(request[key]) && request[key].length <= 2048);
}
function matches(record, request) {
  return record && ['runId', 'operationId', 'action', 'target', 'receiptId']
    .every(key => record[key] === request[key]);
}
function validTime(value, earliest, now, maxAgeMs) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time >= earliest && time <= now &&
    now - time <= maxAgeMs;
}
async function bounded(callback, input, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => callback(input, {signal: controller.signal})),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error('Verification deadline exceeded'), {code: 'ETIMEDOUT'}));
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Use only at the system-action response boundary. candidateText is discarded:
 * regex cannot prove arbitrary prose true. No stdout/stderr, stacks or model text
 * reach the response/audit; retain raw evidence in the protected receipt store.
 * Adapters must honor AbortSignal. A timed-out write may still have happened.
 */
export function createEvidenceResponseFilter({
  readReceipt, verifyState, appendAudit, clock = Date.now,
  timeoutMs = 5000, maxAgeMs = 300000
} = {}) {
  for (const adapter of [readReceipt, verifyState, appendAudit, clock]) {
    if (typeof adapter !== 'function') throw new TypeError('Trusted backend adapters are required');
  }
  for (const limit of [timeoutMs, maxAgeMs]) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 3600000) {
      throw new TypeError('Invalid evidence deadline');
    }
  }

  return async function filterSystemReply(request = {}) {
    // Copy only expected primitive fields; model-supplied evidence is never used.
    const identity = Object.fromEntries(
      ['runId', 'operationId', 'action', 'target', 'receiptId']
        .map(key => [key, request?.[key]])
    );
    const valid = requestValid(identity);
    let status = valid ? 'blocked' : 'unavailable';
    let reason = valid ? 'MISSING_EVIDENCE' : 'INVALID_REQUEST';
    let evidence;
    let verification;
    try {
      if (valid) {
        evidence = await bounded(readReceipt, Object.freeze({...identity}), timeoutMs);
        if (!matches(evidence, identity)) {
          reason = 'RECEIPT_IDENTITY_MISMATCH';
        } else if (!nonempty(evidence.executorId) || !nonempty(evidence.proposerId) ||
          evidence.issuer === 'llm_model' || evidence.forged === true) {
          reason = 'INVALID_EXECUTOR';
        } else if (!validTime(evidence.observedAt, 0, clock(), maxAgeMs)) {
          reason = 'STALE_OR_INVALID_RECEIPT';
        } else if (['failed', 'denied'].includes(evidence.status)) {
          status = evidence.status;
          reason = 'EXECUTOR_REPORTED_FAILURE';
        } else if (['pending', 'queued', 'running', 'proposed'].includes(evidence.status)) {
          status = 'pending';
          reason = 'EXECUTION_INCOMPLETE';
        } else if (evidence.status === 'unknown' || evidence.timedOut === true ||
          evidence.interrupted === true) {
          status = 'unknown';
          reason = 'EXECUTION_UNCERTAIN';
        } else if (evidence.status !== 'completed' || evidence.ok === false ||
          evidence.success === false || evidence.error) {
          reason = 'NO_SUCCESSFUL_EXECUTION';
        } else if (!(evidence.kind === 'process' && evidence.exitCode === 0 &&
          evidence.signal == null) && !(evidence.kind === 'api' &&
          Number.isInteger(evidence.httpStatus) && evidence.httpStatus >= 200 &&
          evidence.httpStatus < 300 && evidence.providerConfirmed === true)) {
          reason = 'EXECUTION_PROOF_MISSING';
        } else {
          verification = await bounded(verifyState, Object.freeze({...identity}), timeoutMs);
          if (!matches(verification, identity) || verification.verified !== true ||
            verification.issuer === 'llm_model' || verification.forged === true ||
            !nonempty(verification.verifierId) ||
            [evidence.executorId, evidence.proposerId].includes(verification.verifierId) ||
            !validTime(verification.observedAt, Date.parse(evidence.observedAt), clock(), maxAgeMs)) {
            reason = 'POSTCONDITION_NOT_INDEPENDENTLY_VERIFIED';
          } else {
            status = 'verified';
            reason = 'EXECUTION_AND_STATE_VERIFIED';
          }
        }
      }
    } catch (error) {
      status = ['EACCES', 'EPERM'].includes(error?.code) ? 'denied' : 'unknown';
      reason = status === 'denied' ? 'VERIFICATION_ACCESS_DENIED' : 'VERIFICATION_UNAVAILABLE';
    }

    // The audit adapter must acknowledge durable persistence, not just queuing.
    let audit;
    try {
      const event = Object.freeze({
        ...(valid ? identity : {}), status, reason,
        executorId: nonempty(evidence?.executorId) ? evidence.executorId : null,
        verifierId: nonempty(verification?.verifierId) ? verification.verifierId : null,
        checkedAt: new Date(clock()).toISOString()
      });
      audit = await bounded(appendAudit, event, timeoutMs);
      if (audit?.persisted !== true || !nonempty(audit.eventId)) {
        throw new Error('Audit persistence was not confirmed');
      }
    } catch {
      return {allowed: false, status: 'blocked', reason: 'AUDIT_UNAVAILABLE', text: messages.audit};
    }
    return {
      allowed: status === 'verified', status, reason, text: messages[status],
      auditId: audit.eventId,
      ...(valid ? {operationId: identity.operationId, receiptId: identity.receiptId} : {})
    };
  };
}

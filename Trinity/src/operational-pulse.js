/**
 * Trinity operational pulse: honest, read-only assessment of runtime evidence.
 * This module does not start an agent, unlock tools, or claim autonomous execution.
 * It is intended as a shared gate for the Control Center and orchestration layer.
 */
const STAGES = Object.freeze(['planner', 'toolRegistry', 'toolExecutor', 'memory', 'receiptLedger']);

export function assessOperationalPulse(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Operational pulse requires an observation object');
  }
  const checkedAt = new Date(now);
  if (!Number.isFinite(checkedAt.getTime())) throw new TypeError('Invalid check time');
  const observations = {};
  for (const stage of STAGES) {
    const value = input[stage];
    const valid = value && typeof value === 'object' && !Array.isArray(value);
    const verified = valid && value.verified === true &&
      typeof value.receiptId === 'string' && value.receiptId.trim().length > 0 &&
      typeof value.checkedAt === 'string' &&
      Number.isFinite(Date.parse(value.checkedAt)) &&
      Date.parse(value.checkedAt) <= checkedAt.getTime() &&
      checkedAt.getTime() - Date.parse(value.checkedAt) <= 5 * 60 * 1000;
    observations[stage] = {
      status: verified ? 'verified' : 'unverified',
      receiptId: verified ? value.receiptId : null
    };
  }
  const verifiedCount = Object.values(observations).filter(v => v.status === 'verified').length;
  return Object.freeze({
    status: verifiedCount === STAGES.length ? 'operational_evidence_present' : 'not_verified',
    checkedAt: checkedAt.toISOString(),
    stagesVerified: verifiedCount,
    stagesRequired: STAGES.length,
    observations: Object.freeze(observations),
    autonomousExecutionConfirmed: false,
    note: 'Full operation requires an independently tested task-to-tool-to-receipt round trip.'
  });
}

export function requiredOperationalStages() {
  return [...STAGES];
}

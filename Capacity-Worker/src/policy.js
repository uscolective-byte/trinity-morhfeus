export function workUnits(value, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 1_000_000) {
    throw new Error('Work units must be a bounded integer.');
  }
  return value;
}

export function dailyLimit(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,6}$/.test(value)) {
    throw new Error('DAILY_WORK_UNITS must be configured.');
  }
  return workUnits(Number(value));
}

export function requestId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('A unique UUID reservation ID is required.');
  }
  return value.toLowerCase();
}

export const periodAt = now => new Date(now).toISOString().slice(0, 10);

export function capacityStatus(used, limit) {
  const fraction = used / limit;
  return {
    used, limit, remaining: Math.max(0, limit - used),
    stage: fraction >= 0.95 ? 'paused' : fraction >= 0.85 ? 'restricted' : fraction >= 0.70 ? 'slowed' : 'normal',
    spacing_ms: fraction >= 0.95 ? null : fraction >= 0.85 ? 10000 : fraction >= 0.70 ? 2000 : 0,
    unit: 'application-work-unit',
    provider_billing_verified: false
  };
}

export function admission({ spent, reserved, nextAdmission }, units, limit, now) {
  const projected = spent + reserved + units;
  const status = capacityStatus(projected, limit);
  if (projected / limit >= 0.95) {
    return { allowed: false, reason: 'budget_guard', retry_at: Date.parse(periodAt(now) + 'T00:00:00Z') + 86400000 };
  }
  if (now < nextAdmission) return { allowed: false, reason: 'cooldown', retry_at: nextAdmission };
  return { allowed: true, nextAdmission: now + status.spacing_ms };
}

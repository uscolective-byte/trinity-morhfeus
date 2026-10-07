import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { admission, capacityStatus, dailyLimit, periodAt, requestId, workUnits } from './policy.js';

export class CapacityLedger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS periods (
      period TEXT PRIMARY KEY, spent INTEGER NOT NULL DEFAULT 0,
      reserved INTEGER NOT NULL DEFAULT 0, next_admission INTEGER NOT NULL DEFAULT 0
    )`);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY, period TEXT NOT NULL, estimate INTEGER NOT NULL,
      actual INTEGER, created_at INTEGER NOT NULL, settled_at INTEGER
    )`);
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS reservations_period ON reservations(period)');
  }

  row(period) {
    return this.ctx.storage.sql.exec('SELECT * FROM periods WHERE period=?', period).toArray()[0]
      || { period, spent: 0, reserved: 0, next_admission: 0 };
  }

  view(period, limit) {
    const row = this.row(period);
    return { period, ...capacityStatus(row.spent + row.reserved, limit),
      spent: row.spent, reserved: row.reserved, next_admission_at: row.next_admission,
      accounting: 'caller-reported; unsettled reservations remain charged' };
  }

  async status() {
    return this.view(periodAt(Date.now()), dailyLimit(this.env.DAILY_WORK_UNITS));
  }

  async reserve(input) {
    const id = requestId(input?.id), units = workUnits(input?.units);
    const limit = dailyLimit(this.env.DAILY_WORK_UNITS), now = Date.now(), period = periodAt(now);
    return this.ctx.storage.transactionSync(() => {
      // Retain receipts for seven days. Callers must use globally unique UUIDs.
      const cutoff = periodAt(now - 7 * 86400000);
      this.ctx.storage.sql.exec('DELETE FROM reservations WHERE period<?', cutoff);
      this.ctx.storage.sql.exec('DELETE FROM periods WHERE period<?', cutoff);
      const prior = this.ctx.storage.sql.exec('SELECT * FROM reservations WHERE id=?', id).toArray()[0];
      if (prior) {
        if (prior.estimate !== units) throw new Error('Reservation ID was reused with a different estimate.');
        return { allowed: prior.period === period && prior.actual === null,
          reason: prior.actual !== null ? 'already_settled' : prior.period !== period ? 'expired_period' : 'reserved',
          id, period: prior.period, reused: true, status: this.view(period, limit) };
      }
      const row = this.row(period);
      const decision = admission({ spent: row.spent, reserved: row.reserved, nextAdmission: row.next_admission }, units, limit, now);
      if (!decision.allowed) return { ...decision, id, period, status: this.view(period, limit) };
      this.ctx.storage.sql.exec(`INSERT INTO periods(period,reserved,next_admission) VALUES(?,?,?)
        ON CONFLICT(period) DO UPDATE SET reserved=reserved+excluded.reserved,next_admission=excluded.next_admission`,
      period, units, decision.nextAdmission);
      this.ctx.storage.sql.exec('INSERT INTO reservations(id,period,estimate,created_at) VALUES(?,?,?,?)', id, period, units, now);
      return { allowed: true, reason: 'reserved', id, period, reused: false, status: this.view(period, limit) };
    });
  }

  async settle(input) {
    const id = requestId(input?.id), actual = workUnits(input?.actual_units, true);
    const limit = dailyLimit(this.env.DAILY_WORK_UNITS);
    return this.ctx.storage.transactionSync(() => {
      const row = this.ctx.storage.sql.exec('SELECT * FROM reservations WHERE id=?', id).toArray()[0];
      if (!row) throw new Error('Reservation not found.');
      if (row.actual !== null) {
        if (row.actual !== actual) throw new Error('Settlement differs from the stored receipt.');
        return { id, settled: true, reused: true, status: this.view(row.period, limit) };
      }
      this.ctx.storage.sql.exec('UPDATE periods SET reserved=reserved-?,spent=spent+? WHERE period=?', row.estimate, actual, row.period);
      this.ctx.storage.sql.exec('UPDATE reservations SET actual=?,settled_at=? WHERE id=?', actual, Date.now(), id);
      return { id, settled: true, reused: false, status: this.view(row.period, limit) };
    });
  }
}

export default class CapacityService extends WorkerEntrypoint {
  ledger() { return this.env.CAPACITY.getByName('trinity-global-budget'); }
  async getStatus() { return this.ledger().status(); }
  async reserve(input) { return this.ledger().reserve(input); }
  async settle(input) { return this.ledger().settle(input); }
  async fetch() {
    // RPC through an explicitly configured service binding only.
    return new Response('Use the internal service binding.', { status: 404 });
  }
}

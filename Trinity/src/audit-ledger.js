/**
 * @module TRINITY_OMNI_CORE
 * @subsystem RING_0_ASYNC_AUDIT_LEDGER
 * @description Non-blocking D1 audit ledger using ctx.waitUntil(env.DB.prepare(...).run())
 */

const AUDIT_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    environment TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT,
    timestamp INTEGER NOT NULL
)`;

const AUDIT_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)`;

async function persistAuditLogRow(db, row) {
  if (!db || typeof db.prepare !== 'function') return { ok: false, reason: 'missing_d1_binding' };
  try {
    await db
      .prepare('INSERT INTO audit_logs (id, actor, environment, action, payload, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(row.id, row.actor, row.environment, row.action, row.payload, row.timestamp)
      .run();
    return { ok: true, id: row.id };
  } catch {
    try {
      await db.prepare(AUDIT_SCHEMA_SQL).run();
      await db.prepare(AUDIT_INDEX_SQL).run();
      await db
        .prepare('INSERT INTO audit_logs (id, actor, environment, action, payload, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind(row.id, row.actor, row.environment, row.action, row.payload, row.timestamp)
        .run();
      return { ok: true, id: row.id, initialized_schema: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }
}

export function recordAuditLog(env = {}, ctx = null, entry = {}) {
  const db = env?.DB || env?.TRINITY_D1 || null;
  const row = {
    id: String(entry.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`)),
    actor: String(entry.actor || 'Basterix'),
    environment: String(entry.environment || env?.ENVIRONMENT || env?.TRINITY_ENV || 'production'),
    action: String(entry.action || 'SYSTEM_MUTATION'),
    payload: typeof entry.payload === 'string' ? entry.payload : JSON.stringify(entry.payload ?? {}),
    timestamp: Number.isFinite(Number(entry.timestamp)) ? Number(entry.timestamp) : Date.now()
  };

  const writePromise = persistAuditLogRow(db, row);
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(writePromise);
  }
  return {
    id: row.id,
    actor: row.actor,
    environment: row.environment,
    action: row.action,
    timestamp: row.timestamp,
    dispatched: Boolean(ctx && typeof ctx.waitUntil === 'function'),
    promise: writePromise
  };
}

export async function listAuditLogs(env = {}, limit = 50) {
  const db = env?.DB || env?.TRINITY_D1 || null;
  if (!db || typeof db.prepare !== 'function') return [];
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  try {
    const res = await db
      .prepare('SELECT id, actor, environment, action, payload, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT ?1')
      .bind(safeLimit)
      .all();
    return Array.isArray(res?.results) ? res.results : [];
  } catch {
    return [];
  }
}

-- Review-only Foundation schema. NOT part of automatic Wrangler migrations.
-- Apply only to a separately authorized isolated TAP_DB. No existing table is changed.
CREATE TABLE IF NOT EXISTS tap_runs (
  run_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment IN ('local','staging','production')),
  sender_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('REQUESTED','QUEUED','RUNNING','COMPLETED','VERIFIED','FAILED','CANCELLED','UNKNOWN_OUTCOME')),
  response_json TEXT,
  UNIQUE(environment,sender_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS tap_evidence_receipts (
  receipt_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES tap_runs(run_id),
  task_id TEXT NOT NULL,
  artifact_key TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  receipt_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tap_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES tap_runs(run_id),
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL
);

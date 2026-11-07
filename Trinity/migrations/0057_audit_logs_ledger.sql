-- Module 4: Asynchronous D1 Audit Ledger (Ring 0 Compliance)
-- Target Databases: trinity-v03 (production / auru.space) & trinity-development (staging / auru.dev)

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    environment TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT,
    timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

-- Trinity Copilot Audit and Session Management
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details TEXT
);

CREATE TABLE IF NOT EXISTS copilot_sessions (
  session_id TEXT PRIMARY KEY,
  history TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_level ON audit(level);
CREATE INDEX IF NOT EXISTS idx_copilot_sessions_updated ON copilot_sessions(updated_at);

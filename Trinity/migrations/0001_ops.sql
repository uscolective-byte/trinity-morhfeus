CREATE TABLE IF NOT EXISTS ops_agents (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, cluster TEXT NOT NULL, role TEXT NOT NULL,
 tools TEXT NOT NULL, version TEXT NOT NULL DEFAULT '6.1.0'
);
CREATE TABLE IF NOT EXISTS ops_jobs (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL, task TEXT NOT NULL, team TEXT NOT NULL,
 provider TEXT NOT NULL DEFAULT 'workers-ai', status TEXT NOT NULL DEFAULT 'queued',
 result TEXT, error TEXT, artifact_key TEXT, idempotency_key TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ops_steps (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL, position INTEGER NOT NULL, agent_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', result TEXT, model TEXT, tool_log TEXT,
 duration_ms INTEGER, error TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(job_id, position), FOREIGN KEY(job_id) REFERENCES ops_jobs(id)
);
CREATE TABLE IF NOT EXISTS ops_memory (
 key TEXT PRIMARY KEY, value TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'user',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ops_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT, action TEXT NOT NULL,
 details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ops_sessions (
 token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ops_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ops_jobs_created ON ops_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_ops_jobs_session ON ops_jobs(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ops_steps_job ON ops_steps(job_id, position);

-- Trinity agent lab: persist real owners, runs, and domain intent.
-- No registration, DNS change or deployment is performed by this migration.
CREATE TABLE IF NOT EXISTS ops_custom_agents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  role TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  temperature REAL NOT NULL DEFAULT 0.7 CHECK (temperature BETWEEN 0 AND 2),
  tools_json TEXT NOT NULL DEFAULT '[]',
  autonomous_mode INTEGER NOT NULL DEFAULT 0 CHECK (autonomous_mode IN (0,1)),
  domain_binding TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_agents_owner_created
ON ops_custom_agents (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_agent_executions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT,
  steps_json TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'completed',
  duration_ms INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_executions_owner_created
ON ops_agent_executions (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_created
ON ops_agent_executions (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_agent_domains (
  domain_name TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  zone_id TEXT,
  status TEXT NOT NULL DEFAULT 'unverified',
  dns_records_json TEXT DEFAULT '[]',
  ssl_mode TEXT DEFAULT 'strict',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_domains_owner
ON ops_agent_domains (owner_id);

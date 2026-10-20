CREATE TABLE IF NOT EXISTS self_improvement_proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('plugin_install','code_improvement','deployment')),
  plugin_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected')),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_self_improvement_status_created
  ON self_improvement_proposals(status, created_at DESC);

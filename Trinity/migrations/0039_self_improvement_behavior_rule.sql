-- Povolí druh návrhu 'behavior_rule' (SQLite neumožňuje meniť CHECK, preto prebuduje tabuľku).
CREATE TABLE self_improvement_proposals_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('plugin_install','code_improvement','deployment','behavior_rule')),
  plugin_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected')),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO self_improvement_proposals_new
  SELECT id,title,description,kind,plugin_id,status,created_by,approved_by,result_json,created_at,updated_at
  FROM self_improvement_proposals;
DROP TABLE self_improvement_proposals;
ALTER TABLE self_improvement_proposals_new RENAME TO self_improvement_proposals;
CREATE INDEX IF NOT EXISTS idx_self_improvement_status_created
  ON self_improvement_proposals(status, created_at DESC);

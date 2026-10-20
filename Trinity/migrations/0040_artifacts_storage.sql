-- Migrácia 0040: Evidencia artefaktov a vygenerovaných súborov v D1
CREATE TABLE IF NOT EXISTS ops_artifacts (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ops_artifacts_created_at ON ops_artifacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_artifacts_filename ON ops_artifacts(filename);

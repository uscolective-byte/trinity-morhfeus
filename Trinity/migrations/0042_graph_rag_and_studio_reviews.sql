-- Migration 0042: Graph RAG and Studio Code Reviews
CREATE TABLE IF NOT EXISTS graph_memory_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'project', 'domain', 'note', 'transaction', 'entity', 'topic'
  label TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS graph_memory_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES graph_memory_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES graph_memory_nodes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL, -- 'belongs_to', 'manages', 'hosts', 'transacted', 'relates_to', 'depends_on'
  weight REAL NOT NULL DEFAULT 1.0,
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_memory_nodes(type);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_memory_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_memory_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_rel ON graph_memory_edges(relationship);

CREATE TABLE IF NOT EXISTS studio_code_reviews (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  score_performance INTEGER NOT NULL DEFAULT 95,
  score_accessibility INTEGER NOT NULL DEFAULT 95,
  score_best_practices INTEGER NOT NULL DEFAULT 100,
  score_seo INTEGER NOT NULL DEFAULT 95,
  issues_json TEXT NOT NULL DEFAULT '[]',
  passed_checks_json TEXT NOT NULL DEFAULT '[]',
  generated_tests_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_studio_reviews_proj ON studio_code_reviews(project_id);

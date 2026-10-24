CREATE TABLE IF NOT EXISTS ops_chat_incidents (
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  resolution TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (job_id,kind)
);

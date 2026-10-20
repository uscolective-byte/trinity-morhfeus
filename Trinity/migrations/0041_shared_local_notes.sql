CREATE TABLE IF NOT EXISTS ops_shared_notes (
 id TEXT PRIMARY KEY,
 text TEXT NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

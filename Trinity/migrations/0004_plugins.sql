CREATE TABLE IF NOT EXISTS ops_plugins (id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT OR IGNORE INTO ops_plugins(id) VALUES ('memory'),('projects'),('web'),('monitor'),('calculator'),('text'),('mcp'),('artifacts');

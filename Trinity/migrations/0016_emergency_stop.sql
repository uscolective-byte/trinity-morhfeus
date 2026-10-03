CREATE TABLE IF NOT EXISTS ops_control(
 id INTEGER PRIMARY KEY CHECK(id=1),
 emergency_stop INTEGER NOT NULL DEFAULT 0 CHECK(emergency_stop IN (0,1)),
 reason TEXT,
 updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO ops_control(id,emergency_stop,reason,updated_by) VALUES(1,0,NULL,'system') ON CONFLICT(id) DO NOTHING;

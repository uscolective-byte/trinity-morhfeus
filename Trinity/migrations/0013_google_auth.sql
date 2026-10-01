ALTER TABLE ops_sessions ADD COLUMN email TEXT;
CREATE INDEX IF NOT EXISTS idx_ops_sessions_email ON ops_sessions(email);

CREATE TABLE IF NOT EXISTS ops_users (
 email TEXT PRIMARY KEY COLLATE NOCASE,
 google_sub TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','rejected','blocked')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 approved_at TEXT,
 approved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_ops_users_status ON ops_users(status,created_at);

CREATE TABLE IF NOT EXISTS ops_oauth_states (
 state_hash TEXT PRIMARY KEY,
 nonce TEXT NOT NULL,
 code_verifier TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);

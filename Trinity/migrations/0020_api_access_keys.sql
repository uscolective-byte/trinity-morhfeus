CREATE TABLE IF NOT EXISTS ops_api_access_keys (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60 CHECK(rate_limit_per_minute BETWEEN 1 AND 600),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_access_keys_owner ON ops_api_access_keys(owner_id,created_at DESC);
CREATE TABLE IF NOT EXISTS ops_api_key_usage (
  key_id TEXT NOT NULL,
  minute_window INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(key_id,minute_window),
  FOREIGN KEY(key_id) REFERENCES ops_api_access_keys(id) ON DELETE CASCADE
);

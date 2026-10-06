CREATE TABLE IF NOT EXISTS ops_api_definitions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'GET' CHECK(method IN ('GET','POST')),
  response_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id,slug)
);
CREATE INDEX IF NOT EXISTS idx_api_definitions_owner_updated ON ops_api_definitions(owner_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS ops_api_invocations (
  id TEXT PRIMARY KEY,
  api_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  request_method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(api_id) REFERENCES ops_api_definitions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_api_invocations_api_created ON ops_api_invocations(api_id,created_at DESC);

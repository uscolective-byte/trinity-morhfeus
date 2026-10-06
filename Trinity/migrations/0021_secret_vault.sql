CREATE TABLE IF NOT EXISTS ops_secret_vault (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('github','cloudflare','custom')),
  name TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  secret_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stored' CHECK(status IN ('stored','verified','failed','revoked')),
  verification_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_verified_at TEXT,
  revoked_at TEXT,
  UNIQUE(owner_id,provider,name)
);
CREATE INDEX IF NOT EXISTS idx_secret_vault_owner ON ops_secret_vault(owner_id,created_at DESC);

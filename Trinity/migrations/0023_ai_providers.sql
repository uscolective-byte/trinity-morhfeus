CREATE TABLE ops_secret_vault_next (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('github','cloudflare','gemini','custom')),
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

INSERT INTO ops_secret_vault_next
SELECT id,owner_id,provider,name,secret_ciphertext,secret_iv,secret_hint,status,
       verification_json,created_at,updated_at,last_verified_at,revoked_at
FROM ops_secret_vault;

DROP TABLE ops_secret_vault;
ALTER TABLE ops_secret_vault_next RENAME TO ops_secret_vault;
CREATE INDEX idx_secret_vault_owner ON ops_secret_vault(owner_id,created_at DESC);

CREATE TABLE ops_ai_provider_settings (
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('gemini')),
  secret_id TEXT NOT NULL,
  model TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(owner_id,provider),
  FOREIGN KEY(secret_id) REFERENCES ops_secret_vault(id)
);

CREATE INDEX idx_ai_provider_enabled ON ops_ai_provider_settings(provider,enabled,updated_at DESC);

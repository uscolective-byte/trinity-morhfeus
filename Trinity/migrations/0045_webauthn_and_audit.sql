-- 0045_webauthn_and_audit.sql: Passkey / WebAuthn Biometric Login & Audit Trail Indexes

CREATE TABLE IF NOT EXISTS user_passkeys (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  friendly_name TEXT,
  transports TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_email ON user_passkeys(user_email);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_cred ON user_passkeys(credential_id);

CREATE TABLE IF NOT EXISTS ops_passkey_challenges (
  challenge_hash TEXT PRIMARY KEY,
  user_email TEXT,
  type TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires ON ops_passkey_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_ops_events_action ON ops_events(action);
CREATE INDEX IF NOT EXISTS idx_ops_events_created ON ops_events(created_at);

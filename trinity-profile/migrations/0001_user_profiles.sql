CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  alias TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  organization TEXT,
  wallet_address TEXT,
  ttk_balance REAL NOT NULL DEFAULT 0,
  preferences_json TEXT NOT NULL DEFAULT '{}',
  api_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_api_key_hash_unique
  ON user_profiles(api_key_hash)
  WHERE api_key_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_profiles_status_updated_at
  ON user_profiles(status, updated_at);

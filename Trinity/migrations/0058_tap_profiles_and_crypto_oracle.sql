-- Module: TAP ProfileMaker (Worker #47) & Jericho123 Crypto Oracle + Tetrakis Vaults (Worker #26)
-- Target Databases: trinity-v03 (production) & trinity-development (staging)

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'guest',
    permissions TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

CREATE TABLE IF NOT EXISTS crypto_price_cache (
    symbol TEXT PRIMARY KEY,
    price_usd REAL NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crypto_price_updated_at ON crypto_price_cache(updated_at);

CREATE TABLE IF NOT EXISTS tetrakis_vaults (
    wallet_address TEXT PRIMARY KEY,
    owner_profile_id TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0.0,
    locked_stake REAL NOT NULL DEFAULT 0.0,
    last_action_timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tetrakis_vaults_owner ON tetrakis_vaults(owner_profile_id);

-- Worker #24 (trinity-treasury) D1 Schema Migration
-- Target Databases: trinity-development (aura.dev staging) -> trinity-v03 (aura.space production)

CREATE TABLE IF NOT EXISTS ttk_vaults (
    vault_id TEXT PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    owner_profile_id TEXT NOT NULL,
    balance_ttk REAL NOT NULL DEFAULT 0.0,
    locked_stake_ttk REAL NOT NULL DEFAULT 0.0,
    network TEXT NOT NULL DEFAULT 'base-mainnet',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ttk_vaults_owner ON ttk_vaults(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_ttk_vaults_wallet ON ttk_vaults(wallet_address);

CREATE TABLE IF NOT EXISTS ttk_transactions (
    tx_id TEXT PRIMARY KEY,
    tx_hash TEXT UNIQUE,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount_ttk REAL NOT NULL,
    tx_type TEXT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 8453,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ttk_transactions_from ON ttk_transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_ttk_transactions_to ON ttk_transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_ttk_transactions_created ON ttk_transactions(created_at);

CREATE TABLE IF NOT EXISTS crypto_payments (
    payment_id TEXT PRIMARY KEY,
    payer_address TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    asset_symbol TEXT NOT NULL DEFAULT 'TTK',
    amount REAL NOT NULL,
    usd_value REAL NOT NULL,
    oracle_price_usd REAL NOT NULL,
    tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'SETTLED',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crypto_payments_payer ON crypto_payments(payer_address);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_created ON crypto_payments(created_at);

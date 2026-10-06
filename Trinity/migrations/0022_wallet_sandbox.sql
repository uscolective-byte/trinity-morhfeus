CREATE TABLE IF NOT EXISTS wallet_accounts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Trinity Wallet Sandbox',
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents>=0),
  mode TEXT NOT NULL DEFAULT 'sandbox' CHECK(mode='sandbox'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('deposit','withdrawal','send')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
  balance_after_cents INTEGER NOT NULL CHECK(balance_after_cents>=0),
  recipient TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'simulated' CHECK(status='simulated'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(wallet_id) REFERENCES wallet_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_owner ON wallet_transactions(owner_id,created_at DESC);

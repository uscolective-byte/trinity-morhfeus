CREATE TABLE IF NOT EXISTS trading_portfolios (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'EUR', starting_cash_cents INTEGER NOT NULL CHECK(starting_cash_cents >= 0),
  max_position_pct INTEGER NOT NULL DEFAULT 20 CHECK(max_position_pct BETWEEN 1 AND 100),
  max_drawdown_pct INTEGER NOT NULL DEFAULT 15 CHECK(max_drawdown_pct BETWEEN 1 AND 100),
  paper_only INTEGER NOT NULL DEFAULT 1 CHECK(paper_only = 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trading_portfolios_owner ON trading_portfolios(owner_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS trading_transactions (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL, owner_id TEXT NOT NULL, symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('stock','etf','crypto','bond','commodity','forex','other')),
  side TEXT NOT NULL CHECK(side IN ('buy','sell')), quantity_micros INTEGER NOT NULL CHECK(quantity_micros > 0),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0), fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(fee_cents >= 0),
  executed_at TEXT NOT NULL, thesis TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(portfolio_id) REFERENCES trading_portfolios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_trading_transactions_portfolio_time ON trading_transactions(portfolio_id,executed_at,id);
CREATE INDEX IF NOT EXISTS idx_trading_transactions_owner_symbol ON trading_transactions(owner_id,symbol);
CREATE TABLE IF NOT EXISTS trading_quotes (
  owner_id TEXT NOT NULL, symbol TEXT NOT NULL, currency TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0), as_of TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(owner_id,symbol,currency)
);
CREATE TABLE IF NOT EXISTS trading_journal (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL, owner_id TEXT NOT NULL, title TEXT NOT NULL,
  thesis TEXT NOT NULL, risks TEXT NOT NULL DEFAULT '', lesson TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(portfolio_id) REFERENCES trading_portfolios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_trading_journal_portfolio ON trading_journal(portfolio_id,updated_at DESC);

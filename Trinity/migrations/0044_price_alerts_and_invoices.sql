-- Migration 0044: Commodity Price Alerts, SEPA Invoices & Net Worth Tracking

CREATE TABLE IF NOT EXISTS commodity_price_alerts (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  condition TEXT NOT NULL, -- 'above', 'below', 'cross_support', 'cross_resistance'
  target_price REAL NOT NULL,
  current_price REAL,
  support_level REAL,
  resistance_level REAL,
  notify_channel TEXT NOT NULL DEFAULT 'telegram',
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'triggered', 'muted'
  triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON commodity_price_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_price_alerts_status ON commodity_price_alerts(status);

CREATE TABLE IF NOT EXISTS generated_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  amount_eur REAL NOT NULL,
  variable_symbol TEXT,
  item_description TEXT NOT NULL,
  iban TEXT NOT NULL,
  bic TEXT,
  qr_svg TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid', 'cancelled'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON generated_invoices(status);

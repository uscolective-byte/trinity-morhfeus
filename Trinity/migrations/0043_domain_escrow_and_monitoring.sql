-- Migration 0043: Domain Escrow Brokering, Monitoring Alerts & A/B Environment Clones

CREATE TABLE IF NOT EXISTS domain_escrow_deals (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  deal_type TEXT NOT NULL, -- 'instant_buy', 'lease_to_own', 'make_offer'
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  buyer_email TEXT,
  buyer_notes TEXT,
  target_dns TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'settled', 'cancelled'
  payment_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_escrow_deals_domain ON domain_escrow_deals(domain_name);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_status ON domain_escrow_deals(status);

CREATE TABLE IF NOT EXISTS domain_health_alerts (
  id TEXT PRIMARY KEY,
  domain_name TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'domain_expiry', 'ssl_expiry', 'worker_outage'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  days_remaining INTEGER,
  telegram_sent INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_health_alerts_domain ON domain_health_alerts(domain_name);
CREATE INDEX IF NOT EXISTS idx_health_alerts_resolved ON domain_health_alerts(resolved);

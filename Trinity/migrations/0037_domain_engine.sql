CREATE TABLE IF NOT EXISTS managed_domains (
  id TEXT PRIMARY KEY,
  domain_name TEXT NOT NULL UNIQUE,
  zone_id TEXT,
  registrar TEXT DEFAULT 'cloudflare',
  status TEXT NOT NULL DEFAULT 'active',
  auto_renew INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  nameservers_json TEXT,
  dns_records_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  listing_type TEXT NOT NULL DEFAULT 'none',
  sale_price REAL,
  sale_currency TEXT NOT NULL DEFAULT 'EUR',
  lease_price_monthly REAL,
  lease_currency TEXT NOT NULL DEFAULT 'EUR',
  current_tenant TEXT,
  lease_starts_at TEXT,
  lease_expires_at TEXT,
  buyer TEXT,
  sold_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_managed_domains_status ON managed_domains(status);
CREATE INDEX IF NOT EXISTS idx_managed_domains_name ON managed_domains(domain_name);
CREATE INDEX IF NOT EXISTS idx_managed_domains_listing ON managed_domains(listing_type);

CREATE TABLE IF NOT EXISTS domain_dns_records (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES managed_domains(id) ON DELETE CASCADE,
  record_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 1,
  proxied INTEGER NOT NULL DEFAULT 1,
  priority INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_domain_dns_domain_id ON domain_dns_records(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_dns_name_type ON domain_dns_records(domain_id, name, type);

CREATE TABLE IF NOT EXISTS domain_transactions (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES managed_domains(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  party TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_domain_transactions_domain_id ON domain_transactions(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_transactions_type ON domain_transactions(type);

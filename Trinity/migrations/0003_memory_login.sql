CREATE TABLE IF NOT EXISTS ops_login_tickets (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
ALTER TABLE ops_jobs ADD COLUMN context_summary TEXT;

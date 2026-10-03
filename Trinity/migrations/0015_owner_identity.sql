ALTER TABLE ops_jobs ADD COLUMN owner_mode INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_ops_jobs_owner ON ops_jobs(owner_mode,created_at);

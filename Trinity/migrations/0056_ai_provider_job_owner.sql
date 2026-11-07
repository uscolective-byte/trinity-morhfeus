-- Keep provider settings tied to the authenticated account across async chat jobs.
ALTER TABLE ops_jobs ADD COLUMN owner_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ops_jobs_owner_id ON ops_jobs(owner_id, created_at);

ALTER TABLE ops_jobs ADD COLUMN reasoning_mode TEXT NOT NULL DEFAULT 'auto'
  CHECK (reasoning_mode IN ('auto','standard','quantum'));

CREATE INDEX IF NOT EXISTS idx_ops_jobs_reasoning_mode
  ON ops_jobs(reasoning_mode, created_at DESC);

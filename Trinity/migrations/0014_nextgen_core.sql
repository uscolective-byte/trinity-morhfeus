ALTER TABLE ops_jobs ADD COLUMN intent TEXT NOT NULL DEFAULT 'conversation';
ALTER TABLE ops_jobs ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'low';
ALTER TABLE ops_jobs ADD COLUMN plan_json TEXT NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_ops_jobs_intent ON ops_jobs(intent,risk_level,created_at);

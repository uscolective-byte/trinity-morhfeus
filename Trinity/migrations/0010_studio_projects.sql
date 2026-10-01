CREATE TABLE IF NOT EXISTS ops_studio_projects (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 name TEXT NOT NULL,
 prompt TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ready',
 version INTEGER NOT NULL DEFAULT 1,
 html_key TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_studio_projects_owner ON ops_studio_projects(owner_id,updated_at);
CREATE TABLE IF NOT EXISTS ops_studio_versions (
 project_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 prompt TEXT NOT NULL,
 html_key TEXT NOT NULL,
 model TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(project_id,version),
 FOREIGN KEY(project_id) REFERENCES ops_studio_projects(id)
);
INSERT INTO ops_roadmap(step,name,status,evidence) VALUES (4,'AI Studio builder','ready_for_deploy','Prompt, živý sandboxovaný náhľad, iterácie a verzovanie v R2')
ON CONFLICT(step) DO UPDATE SET name=excluded.name,status=excluded.status,evidence=excluded.evidence,updated_at=datetime('now');

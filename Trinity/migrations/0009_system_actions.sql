CREATE TABLE IF NOT EXISTS ops_system_actions (
 id TEXT PRIMARY KEY,
 action TEXT NOT NULL CHECK(action IN ('read','write','edit','selfwrite','run','deploy','share','upload','upgrade')),
 payload_json TEXT NOT NULL,
 rationale TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('proposed','approved','claimed','completed','failed','rejected','expired')),
 requested_by TEXT NOT NULL,
 approved_by TEXT,
 approved_at INTEGER,
 claimed_by TEXT,
 lease_until INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 receipt_json TEXT,
 error TEXT,
 expires_at INTEGER NOT NULL,
 completed_at INTEGER,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_system_actions_queue ON ops_system_actions(status,expires_at,created_at);

INSERT INTO ops_memory(key,value,source) VALUES (
 'architektura/systemove-schopnosti',
 'Interné systémové schopnosti jednej Trinity: read, write, edit, selfwrite, run, deploy, share, upload a upgrade. Read môže byť automaticky schválené. Každá zmena vyžaduje samostatné výslovné schválenie používateľa, lokálnu bránu, obmedzený rozsah a overiteľné potvrdenie. Trinity nesmie schváliť vlastný návrh.',
 'user:approved-plan'
) ON CONFLICT(key) DO UPDATE SET value=excluded.value,source=excluded.source,updated_at=datetime('now');

INSERT INTO ops_roadmap(step,name,status,evidence) VALUES
 (3,'Privátne systémové schopnosti a lokálna brána','ready_for_deploy','Cloudový rad návrhov, samostatné schvaľovanie, lokálna allowlist brána a potvrdenia')
ON CONFLICT(step) DO UPDATE SET name=excluded.name,status=excluded.status,evidence=excluded.evidence,updated_at=datetime('now');

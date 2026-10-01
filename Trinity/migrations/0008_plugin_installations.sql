ALTER TABLE ops_plugins ADD COLUMN version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE ops_plugins ADD COLUMN installed INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ops_plugins ADD COLUMN source TEXT NOT NULL DEFAULT 'trinity-core';
ALTER TABLE ops_plugins ADD COLUMN installed_at TEXT;

INSERT OR IGNORE INTO ops_plugins(id,version,installed,enabled,source) VALUES
 ('truth','1.0.0',1,1,'trinity-core'),
 ('clock','1.0.0',1,1,'trinity-core'),
 ('capabilities','1.0.0',1,1,'trinity-core');

UPDATE ops_plugins SET installed=1,enabled=1,source='trinity-core',version=CASE id WHEN 'memory' THEN '1.1.0' ELSE '1.0.0' END,installed_at=coalesce(installed_at,datetime('now')),updated_at=datetime('now');

CREATE TABLE IF NOT EXISTS ops_roadmap (
 step INTEGER PRIMARY KEY,
 name TEXT NOT NULL,
 status TEXT NOT NULL,
 evidence TEXT,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO ops_roadmap(step,name,status,evidence) VALUES
 (1,'Pravdivé jadro a stála osobnosť','ready_for_deploy','Truth policy 1.0.0, dôkazová kontrola a trvalý profil osobnosti'),
 (2,'Inštalácia potrebných pluginov','ready_for_deploy','11 modulov v registri, všetky nainštalované a zapnuté')
ON CONFLICT(step) DO UPDATE SET name=excluded.name,status=excluded.status,evidence=excluded.evidence,updated_at=datetime('now');

INSERT INTO ops_memory(key,value,source) VALUES (
 'plan/trinity-rozvoj',
 'Krok 1: Pravdivé jadro a stála osobnosť. Krok 2: Inštalácia potrebných pluginov priamo do jednej Trinity. Ďalšie kroky sa budú pridávať postupne až po otestovaní predchádzajúceho kroku.',
 'user:approved-plan'
) ON CONFLICT(key) DO UPDATE SET value=excluded.value,source=excluded.source,updated_at=datetime('now');

INSERT INTO ops_events(action,details) VALUES ('plugins_installed','{"count":11,"source":"trinity-core","enabled":true}');

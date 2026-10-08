ALTER TABLE ops_ai_provider_settings ADD COLUMN project_control INTEGER NOT NULL DEFAULT 0 CHECK(project_control IN (0,1));
UPDATE ops_ai_provider_settings SET project_control=1 WHERE provider='gemini' AND enabled=1;
INSERT INTO ops_events(action,details) VALUES('gemini_project_control_enabled','{"scope":"all-supported-actions","approval":"owner-required","self_approval":false}');

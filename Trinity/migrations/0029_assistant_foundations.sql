INSERT INTO ops_plugins(id,version,installed,enabled,source,installed_at,updated_at)
VALUES('task-planner','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now'))
ON CONFLICT(id) DO NOTHING;

INSERT INTO ops_plugins(id,version,installed,enabled,source,installed_at,updated_at) VALUES
 ('computer-control','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('workspace-files','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('internet-operator','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('developer-operator','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now'))
ON CONFLICT(id) DO UPDATE SET version=excluded.version,installed=1,enabled=1,source='trinity-core',installed_at=coalesce(ops_plugins.installed_at,datetime('now')),updated_at=datetime('now');

INSERT INTO ops_events(action,details) VALUES
 ('operator_plugins_installed','{"plugins":["computer-control","workspace-files","internet-operator","developer-operator"],"admin_only":true,"source":"trinity-core"}');

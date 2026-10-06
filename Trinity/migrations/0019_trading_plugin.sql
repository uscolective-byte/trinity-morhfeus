INSERT INTO ops_plugins(id,version,installed,enabled,source,installed_at,updated_at)
VALUES('trading','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now'))
ON CONFLICT(id) DO UPDATE SET version='1.0.0',installed=1,enabled=1,source='trinity-core',installed_at=coalesce(ops_plugins.installed_at,datetime('now')),updated_at=datetime('now');
INSERT INTO ops_events(action,details) VALUES('plugin_installed','{"plugin":"trading","source":"trinity-core","paper_only":true}');

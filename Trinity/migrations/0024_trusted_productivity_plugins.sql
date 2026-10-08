INSERT INTO ops_plugins(id,version,installed,enabled,source,installed_at,updated_at) VALUES
 ('memory','1.1.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('projects','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('web','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('images','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('monitor','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('calculator','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('text','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('clock','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('capabilities','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('truth','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('mcp','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('artifacts','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('skills','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('connectors','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('trading','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('json-data','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('checksums','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('units','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('entities','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('text-format','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now'))
ON CONFLICT(id) DO UPDATE SET version=excluded.version,installed=1,enabled=1,source='trinity-core',installed_at=coalesce(ops_plugins.installed_at,datetime('now')),updated_at=datetime('now');

INSERT INTO ops_events(action,details) VALUES ('trusted_plugins_installed','{"count":20,"source":"trinity-core","enabled":true,"external_code":false}');

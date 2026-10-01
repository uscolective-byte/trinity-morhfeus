INSERT OR IGNORE INTO ops_plugins(id,version,installed,enabled,source,installed_at) VALUES
 ('skills','1.0.0',1,1,'trinity-core',datetime('now')),
 ('connectors','1.0.0',1,1,'trinity-core',datetime('now'));

INSERT INTO ops_events(action,details) VALUES
 ('plugins_installed','{"plugins":["skills","connectors"],"source":"trinity-core"}');

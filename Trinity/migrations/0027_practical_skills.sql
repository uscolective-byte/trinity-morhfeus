INSERT INTO ops_plugins(id,version,installed,enabled,source,installed_at,updated_at) VALUES
 ('date-math','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('timezone-converter','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('statistics','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('csv-inspector','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('csv-json','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('text-diff','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('list-cleaner','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('table-transform','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('url-inspector','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('query-string','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('color-converter','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('contrast-checker','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('base64-codec','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('uuid-tools','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('semver','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('data-redactor','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('markdown-inspector','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('html-text','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('business-math','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now')),
 ('geometry','1.0.0',1,1,'trinity-core',datetime('now'),datetime('now'))
ON CONFLICT(id) DO UPDATE SET version=excluded.version,installed=1,enabled=1,source='trinity-core',installed_at=coalesce(ops_plugins.installed_at,datetime('now')),updated_at=datetime('now');

INSERT INTO ops_events(action,details) VALUES ('practical_skills_installed','{"count":20,"source":"trinity-core","enabled":true,"external_code":false}');

INSERT INTO ops_plugins(id,version,installed,enabled,source,installed_at)
VALUES('images','1.0.0',1,1,'trinity-core',datetime('now'))
ON CONFLICT(id) DO UPDATE SET version=excluded.version,installed=1,enabled=1,source=excluded.source,updated_at=datetime('now');

INSERT INTO ops_memory(key,value,source) VALUES (
  'profil/trinity-poznanie-v8',
  'Trinity používa viacjazyčný model a medziodborové znalosti matematiky, prírodných vied, ľudstva, biológie, umelej inteligencie a programovania. Nevyhlasuje, že vie úplne všetko: aktuálne fakty overuje na webe, pri neistote ju prizná a metafyziku odlišuje od experimentálnej vedy. Dokáže vytvárať obrázky cez Workers AI; video a hudba sa smú označiť ako dostupné až po pripojení a živom overení príslušného generátora.',
  'user:explicit-request'
) ON CONFLICT(key) DO UPDATE SET value=excluded.value,source=excluded.source,updated_at=datetime('now');

INSERT INTO ops_events(action,details) VALUES ('cognition_upgraded','{"version":"8.0-local","multilingual":true,"reasoning":true,"image_generation":true,"video_generation":false,"music_generation":false}');

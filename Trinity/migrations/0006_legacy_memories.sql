CREATE TABLE IF NOT EXISTS memory(id TEXT PRIMARY KEY,content TEXT);
CREATE TABLE IF NOT EXISTS knowledge(id INTEGER PRIMARY KEY,topic TEXT,content TEXT);
CREATE TABLE IF NOT EXISTS personality(id INTEGER PRIMARY KEY,trait TEXT,value TEXT);
CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,title TEXT,content TEXT);

INSERT OR IGNORE INTO ops_memory(key,value,source)
SELECT 'minula-trinity/memory/'||id,substr(content,1,10000),'legacy:memory'
FROM memory WHERE content IS NOT NULL AND content<>''
AND lower(content) NOT LIKE '%password%' AND lower(content) NOT LIKE '%api_key%' AND lower(content) NOT LIKE '%api key%' AND lower(content) NOT LIKE '%secret%' AND lower(content) NOT LIKE '%token%' AND content NOT LIKE '%-----BEGIN%';
INSERT OR IGNORE INTO ops_memory(key,value,source)
SELECT 'minula-trinity/knowledge/'||id,substr(coalesce(topic,'')||char(10)||content,1,10000),'legacy:knowledge'
FROM knowledge WHERE content IS NOT NULL AND content<>''
AND lower(content) NOT LIKE '%password%' AND lower(content) NOT LIKE '%api_key%' AND lower(content) NOT LIKE '%api key%' AND lower(content) NOT LIKE '%secret%' AND lower(content) NOT LIKE '%token%' AND content NOT LIKE '%-----BEGIN%';
INSERT OR IGNORE INTO ops_memory(key,value,source)
SELECT 'minula-trinity/personality/'||id,substr(coalesce(trait,'')||': '||value,1,10000),'legacy:personality' FROM personality
WHERE value IS NOT NULL AND value<>''
AND lower(coalesce(trait,'')||' '||value) NOT LIKE '%password%' AND lower(coalesce(trait,'')||' '||value) NOT LIKE '%api_key%'
AND lower(coalesce(trait,'')||' '||value) NOT LIKE '%api key%' AND lower(coalesce(trait,'')||' '||value) NOT LIKE '%secret%'
AND lower(coalesce(trait,'')||' '||value) NOT LIKE '%token%' AND value NOT LIKE '%-----BEGIN%';
INSERT OR IGNORE INTO ops_memory(key,value,source)
SELECT 'minula-trinity/note/'||id,substr(title||char(10)||content,1,10000),'legacy:notes'
FROM notes WHERE content IS NOT NULL AND content<>''
AND lower(coalesce(title,'')||' '||content) NOT LIKE '%password%' AND lower(coalesce(title,'')||' '||content) NOT LIKE '%api_key%'
AND lower(coalesce(title,'')||' '||content) NOT LIKE '%api key%' AND lower(coalesce(title,'')||' '||content) NOT LIKE '%secret%'
AND lower(coalesce(title,'')||' '||content) NOT LIKE '%token%' AND content NOT LIKE '%-----BEGIN%';
INSERT INTO ops_memory(key,value,source) VALUES ('profil/trinity-identita','Používateľ chce jednu osobnú asistentku Trinity, nie 40 oddelených osobností. Modely a špecializácie sú iba jej interné nástroje. Uprednostňuje prirodzený chat, slovenský aj anglický jazyk, spoločnú trvalú pamäť a praktickú pomoc. Citlivé zmeny a self-write iba na výslovný príkaz a po schválení.','user:explicit-request') ON CONFLICT(key) DO UPDATE SET value=excluded.value,source=excluded.source,updated_at=datetime('now');

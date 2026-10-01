export const PLUGINS=[
 {id:'memory',name:'Pamäť',icon:'◈',description:'Ukladá tvoje poznámky a pripomína relevantné informácie pred odpoveďou.',tools:['search_memory'],dependency:'Cloudflare D1',version:'1.1.0'},
 {id:'projects',name:'Projekty',icon:'▦',description:'Číta existujúce projekty a úlohy. Nepredstiera ich dokončenie.',tools:['project_snapshot'],dependency:'Cloudflare D1',version:'1.0.0'},
 {id:'web',name:'Webový výskum',icon:'◎',description:'Vyhľadáva aktuálne zdroje cez overený účet Ollama.',tools:['web_search'],dependency:'Ollama API',version:'1.0.0'},
 {id:'monitor',name:'Strážca služieb',icon:'⌁',description:'Overuje dostupnosť existujúcich služieb Trinity.',tools:['service_status'],dependency:'Service bindings',version:'1.0.0'},
 {id:'calculator',name:'Presné výpočty',icon:'±',description:'Počíta súčet, rozdiel, súčin, podiel, percentá a priemer. Bez spúšťania cudzieho kódu.',tools:['calculate'],dependency:'Lokálny výpočet vo Workeri',version:'1.0.0'},
 {id:'text',name:'Analýza textu',icon:'Aa',description:'Spočíta znaky, slová, vety a odhadne čas čítania.',tools:['analyze_text'],dependency:'Lokálny výpočet vo Workeri',version:'1.0.0'},
 {id:'clock',name:'Čas a dátum',icon:'◷',description:'Vráti skutočný čas pre zadané časové pásmo.',tools:['current_time'],dependency:'Worker runtime',version:'1.0.0'},
 {id:'capabilities',name:'Katalóg schopností',icon:'◇',description:'Ukáže nainštalované a zapnuté moduly jednej Trinity.',tools:['list_capabilities'],dependency:'Plugin registry',version:'1.0.0'},
 {id:'truth',name:'Strážca pravdivosti',icon:'✓',description:'Blokuje nepodložené tvrdenia o vykonaných akciách a oddeľuje fakty od návrhov.',tools:[],dependency:'Truth policy + evidence receipts',version:'1.0.0',required:true},
 {id:'mcp',name:'MCP most',icon:'↔',description:'Päť nástrojov pre pripojenie Trinity k ďalším AI aplikáciám.',tools:[],dependency:'MCP SDK + Agents SDK',version:'1.0.0'},
 {id:'artifacts',name:'Archív výstupov',icon:'↗',description:'Ukladá dokončené výstupy tímu do stiahnuteľných dokumentov.',tools:[],dependency:'Cloudflare R2',version:'1.0.0',required:true},
 {id:'skills',name:'Zručnosti Trinity',icon:'✳',description:'Poskytuje špecializované pracovné postupy pre vývoj, výskum, prevádzku a bezpečnosť.',tools:['list_skills','install_plugin'],dependency:'Zabudovaný katalóg zručností',version:'1.0.0'},
 {id:'connectors',name:'Konektory',icon:'↔',description:'Zobrazuje dostupné Cloudflare bindings a stav nakonfigurovaných služieb bez odhalenia tajomstiev.',tools:['list_connectors'],dependency:'Cloudflare service bindings',version:'1.0.0'}
];
export async function pluginEnabled(env,id){
 const row=await env.DB.prepare('SELECT installed,enabled FROM ops_plugins WHERE id=?').bind(id).first();return row?.installed===1&&row?.enabled===1;
}
export async function listPlugins(env){
 const rows=(await env.DB.prepare('SELECT id,version,installed,enabled,source,installed_at,updated_at FROM ops_plugins').all()).results;
 return PLUGINS.map(p=>{const state=rows.find(r=>r.id===p.id);return {...p,version:state?.version||p.version,installed:state?.installed===1,enabled:state?.installed===1&&state?.enabled===1,source:state?.source||null,installed_at:state?.installed_at||null,updated_at:state?.updated_at||null};});
}
export async function installPlugin(env,id){
 const plugin=PLUGINS.find(item=>item.id===id);if(!plugin)throw new Error('Plugin nie je v dôveryhodnom katalógu Trinity.');
 await env.DB.prepare("INSERT INTO ops_plugins(id,version,installed,enabled,source,installed_at,updated_at) VALUES(?,?,1,1,'trinity-core',datetime('now'),datetime('now')) ON CONFLICT(id) DO UPDATE SET version=excluded.version,installed=1,enabled=1,source='trinity-core',installed_at=coalesce(ops_plugins.installed_at,datetime('now')),updated_at=datetime('now')").bind(plugin.id,plugin.version).run();
 await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('plugin_installed',?)").bind(JSON.stringify({plugin:plugin.id,source:'trinity-core'})).run();
 return {id:plugin.id,name:plugin.name,version:plugin.version,installed:true,enabled:true,source:'trinity-core'};
}
export async function ensureToolEnabled(env,tool){const p=PLUGINS.find(p=>p.tools.includes(tool));if(!p||!await pluginEnabled(env,p.id))throw new Error('Rozšírenie pre tento nástroj je vypnuté.');}

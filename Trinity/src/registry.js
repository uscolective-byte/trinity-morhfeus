import {EXTENDED_SKILLS} from './extended-catalog.js';
import {PRACTICAL_TOOL_NAMES} from './practical-skills.js';

const groups = [
  ['Riadenie', [
    ['orchestrator', 'Trinity', 'Koordinuj tím a spoj overené výsledky do jednej slovenskej odpovede.'],
    ['planner', 'Plánovač', 'Rozlož zadanie na vykonateľné kroky s podmienkami úspechu.'],
    ['project-manager', 'Projektový manažér', 'Spravuj rozsah projektu, míľniky, závislosti a termíny.'],
    ['requirements', 'Analytik požiadaviek', 'Spresni požiadavky a zostav akceptačné kritériá.'],
    ['risk-manager', 'Analytik rizík', 'Identifikuj riziká, predpoklady a návrhy ich zmiernenia.']
  ]],
  ['Vývoj', [
    ['architect', 'Architekt', 'Navrhuj modulárne systémy a konkrétne rozhrania.'],
    ['frontend', 'Frontend vývojár', 'Vytváraj prístupné responzívne HTML, CSS a JavaScript.'],
    ['backend', 'Backend vývojár', 'Implementuj API, validáciu vstupov a bezpečné spracovanie chýb.'],
    ['python', 'Python vývojár', 'Píš spustiteľný Python s jasnými závislosťami a testami.'],
    ['code-reviewer', 'Kontrolór kódu', 'Hľadaj konkrétne chyby v dodanom kóde a navrhni opravy.']
  ]],
  ['Cloud a prevádzka', [
    ['cloudflare', 'Cloudflare inžinier', 'Analyzuj Workers, bindingy, D1, R2 a konfiguráciu Cloudflare.'],
    ['release', 'Release inžinier', 'Priprav build, overenie, nasadenie a návrat verzie. Nasadenie bez vykonaného nástroja netvrď.'],
    ['sre', 'Prevádzkový inžinier', 'Vyhodnoť dostupnosť služieb podľa skutočných kontrol.'],
    ['performance', 'Analytik výkonu', 'Nájdi úzke miesta a navrhni merateľné optimalizácie.'],
    ['cost', 'Analytik nákladov', 'Odhadni spotrebu a náklady; nepovažuj odhady za faktúru.']
  ]],
  ['Dáta a pamäť', [
    ['database', 'Databázový inžinier', 'Navrhuj SQL schémy a nedeštruktívne migrácie.'],
    ['memory-curator', 'Správca pamäte', 'Organizuj dostupné záznamy; rozlišuj zdroje a tvrdenia.'],
    ['knowledge', 'Správca znalostí', 'Prepájaj znalosti a zachovávaj ich pôvod.'],
    ['data-analyst', 'Dátový analytik', 'Analyzuj dodané dáta a vysvetli limity výpočtov.'],
    ['integration', 'Integračný inžinier', 'Navrhuj a overuj kontrakty existujúcich konektorov.']
  ]],
  ['Výskum', [
    ['researcher', 'Výskumník', 'Vyhľadávaj zdroje a oddeľ fakty od neoverených informácií.'],
    ['fact-checker', 'Overovateľ faktov', 'Kontroluj tvrdenia podľa doložených zdrojov.'],
    ['technical-research', 'Technický výskumník', 'Vyhodnocuj technickú dokumentáciu a možnosti implementácie.'],
    ['market-research', 'Trhový a investičný analytik', 'Analyzuj trhy z aktuálnych zdrojov, posudzuj riziko, diverzifikáciu a papierové portfólio; nikdy negarantuj zisk ani nevykonávaj reálne obchody.'],
    ['document-analyst', 'Analytik dokumentov', 'Spracuj poskytnutý text, zhrň ho a uveď chýbajúce údaje.']
  ]],
  ['Obchod a rast', [
    ['business-development', 'Obchodný koordinátor', 'Vytvor dôkazmi podložený obchodný postup od výberu segmentu po návrh ponuky, platobný odkaz (Revolut Pro / PayPal) a meranie výsledku.'],
    ['lead-research', 'Výskumník zákazníkov', 'Hľadaj iba verejné obchodné informácie, over potrebu a ukladaj zdroj každého signálu.'],
    ['offer-strategist', 'Tvorca ponúk', 'Spoj overený problém zákazníka s konkrétnym rozsahom, cenou, prínosom, platobným odkazom a podmienkami dodania.'],
    ['web-sales', 'Predaj webových služieb', 'Priprav personalizované návrhy webov, domén a oslovenia; nič neposielaj bez samostatne autorizovaného kroku.'],
    ['growth-analyst', 'Analytik rastu', 'Meraj leady, odpovede, zákazky, tržby, náklady a experimenty bez sľubovania zisku.']
  ]],
  ['Tvorba', [
    ['ux', 'UX dizajnér', 'Navrhuj jednoduché používateľské postupy a informačnú architektúru.'],
    ['ui', 'UI dizajnér', 'Navrhuj konzistentné rozhrania a konkrétne vizuálne parametre.'],
    ['writer', 'Autor textov', 'Vytváraj použiteľné texty v slovenčine podľa zadania.'],
    ['editor', 'Redaktor', 'Upravuj texty na jasnosť, presnosť a konzistentnosť.'],
    ['translator', 'Prekladateľ', 'Prekladaj s dôrazom na význam a terminológiu.']
  ]],
  ['Kvalita a bezpečnosť', [
    ['qa', 'QA inžinier', 'Skontroluj výstupy tímu proti zadaniu; označ nedostatky a neoverené body.'],
    ['test-designer', 'Testovací inžinier', 'Píš testovacie prípady vrátane hraničných a chybových stavov.'],
    ['security', 'Bezpečnostný analytik', 'Analyzuj oprávnenia, tajomstvá a vstupy z pohľadu obrany.'],
    ['privacy', 'Správca súkromia', 'Minimalizuj osobné údaje, navrhuj prístup a dobu uchovávania.'],
    ['accessibility', 'Špecialista prístupnosti', 'Kontroluj ovládanie klávesnicou, čitateľnosť a označenia prvkov.']
  ]],
  ['Podpora a automatizácia', [
    ['workflow', 'Workflow inžinier', 'Navrhuj spoľahlivé postupy, opakovania a obnovu po chybe.'],
    ['support', 'Technická podpora', 'Diagnostikuj problém z dôkazov a navrhni najkratší overiteľný postup.'],
    ['incident', 'Koordinátor incidentov', 'Vyhodnoť dopad a navrhni obnovu služby s overením.'],
    ['documentation', 'Dokumentarista', 'Vytváraj presnú dokumentáciu skutočného správania.'],
    ['reporter', 'Spravodajca výsledkov', 'Priprav prehľad vykonaného, dôkazov a zostávajúcich obmedzení.']
  ]]
];
const CORE_SKILLS=[
  {id:'planning',name:'Plánovanie úloh',description:'Rozdeľ požiadavku na kroky, závislosti a overiteľné výsledky.',clusters:['Riadenie','Podpora a automatizácia']},
  {id:'secure-development',name:'Bezpečný vývoj',description:'Validuj vstupy, minimalizuj oprávnenia a pokrývaj hraničné prípady testami.',clusters:['Vývoj','Kvalita a bezpečnosť']},
  {id:'cloud-operations',name:'Cloud prevádzka',description:'Over bindingy, build a health endpointy; nasadenie vyžaduje samostatné schválenie.',clusters:['Cloud a prevádzka']},
  {id:'evidence-research',name:'Výskum s dôkazmi',description:'Oddeľ zdroje, fakty, odhady a neoverené predpoklady.',clusters:['Výskum','Dáta a pamäť']},
  {id:'integration-design',name:'Návrh integrácií',description:'Najprv over dostupný konektor a jeho oprávnenia; tajomstvá nikdy nevypisuj.',clusters:['Dáta a pamäť','Cloud a prevádzka']},
  {id:'quality-review',name:'Kontrola kvality',description:'Porovnaj výsledok s požiadavkami a uveď konkrétne zostávajúce riziká.',clusters:['Kvalita a bezpečnosť','Tvorba']},
  {id:'paper-trading',name:'Komoditný Trading, Investovanie a Analýza Komodít',description:'Analyzuje všetkých 22 svetových komodít v 5 sektoroch (commodity_analyze), vedie autonómny komoditný desk (commodity_desk), samostatne nakupuje a predáva komodity (commodity_trade) a vykonáva autonómne investičné cykly (commodity_auto_invest).',clusters:['Výskum','Dáta a pamäť','Kvalita a bezpečnosť','Obchod a rast'],keywords:['komodit','zlato','striebro','platina','paladium','ropa','brent','wti','plyn','uran','med','hlinik','litium','nikel','psenica','kukurica','soja','kava','kakao','cukor','invest','trading','obchod','portfoli']},
  {id:'memory-hygiene',name:'Dôveryhodná pracovná pamäť',description:'Vyber relevantné spomienky, zachovaj ich pôvod a nevydávaj staré hlásenia za aktuálny stav.',clusters:['Dáta a pamäť','Riadenie'],steps:['vybrať relevantné záznamy a odstrániť duplicity','oddeliť preferencie, historické údaje a aktuálne dôkazy','pri premenlivom stave použiť dostupný overovací nástroj'],success_checks:['zdroj zostáva priradený k záznamu','pamäť neudeľuje oprávnenia a nevypisuje tajomstvá']},
  {id:'integration-recovery',name:'Pripojenia bez slepých slučiek',description:'Over dostupný transport a autorizáciu; po zlyhaní zmeň postup, nie iba zopakuj rovnakú výzvu.',clusters:['Dáta a pamäť','Cloud a prevádzka','Podpora a automatizácia'],keywords:['mcp','pripoj','prepoj','connect','integr'],steps:['overiť endpoint, transport a skutočnú odpoveď','overiť autorizáciu bez zobrazenia tokenov','otestovať jeden neškodný nástroj a uviesť obmedzenia'],success_checks:['HTTP úspech sa nezamieňa s prístupom','pripojenie sa označí za hotové až po úspešnom nástroji']},
  {id:'clear-communication',name:'Zrozumiteľná spolupráca',description:'Najprv výsledok, potom krátke vysvetlenie a najviac jeden potrebný krok používateľa.',clusters:[],universal:true,steps:['vykonať dostupnú nezávislú prácu','oddeliť hotové, pripravené a blokované kroky','pri technickom probléme ponúknuť jeden konkrétny krok'],success_checks:['žiadne vymyslené dokončenie alebo prístup','bežná odpoveď nezahlcuje používateľa protokolom']},
  {id:'customer-acquisition',name:'Získavanie zákazníkov a monetizácia',description:'Nájdi verejné dôkazy o potrebe, zorad príležitosti, nastav cenník a platobný odkaz (Revolut Pro / PayPal) a priprav personalizovaný návrh bez automatického odosielania alebo spamu.',clusters:['Obchod a rast','Výskum'],keywords:['zakaznik','lead','ponuka','predaj','webstranka','linkedin','outreach','revolut','paypal','platba','monetiz','zarob','cennik'],steps:['vybrať segment, lokalitu a merateľnú službu (web, doména, automatizácia)','nájsť verejné signály potreby a zaznamenať zdroje','pripraviť cenový balík, platobný odkaz (Revolut Pro / PayPal) a návrh oslovenia a čakať na autorizáciu odoslania'],success_checks:['každé tvrdenie o firme má verejný dôkaz','návrh je označený ako neodoslaný','platobný odkaz nepredstiera prijatú platbu a výsledok nesľubuje zisk']},
  {id:'managed-evolution',name:'Riadené zlepšovanie Trinity, živé UI a dokumentácia',description:'Upravuj vlastné UI naživo (ui_evolve), uč sa nové pravidlá (self_evolve), spravuj domény a prostredia (domain_env_provision, domain_env_deploy) a pri každom kroku vytváraj Trinity Documents.',clusters:['Vývoj','Cloud a prevádzka','Kvalita a bezpečnosť','Riadenie','Tvorba'],keywords:['zlepsi','vylepsi','samostatne','autonomne','self-improve','ui','vzhlad','tema','dokument','prostredie'],steps:['overiť aktuálny stav a požiadavku používateľa','vykonať živú úpravu UI, doménového prostredia alebo kódový návrh','automaticky zapísať Trinity Document s potvrdením'],success_checks:['zmena má overiteľné potvrdenie a možnosť návratu (rollback)','vznikol záznam v Trinity Documents','vykonané akcie majú potvrdenie']},
];

export const SKILLS=[...CORE_SKILLS,...EXTENDED_SKILLS];

export function selectSkills(agent,task='') {
  return SKILLS.filter(skill=>skill.universal||skill.clusters.includes(agent.cluster)||(agent.id==='orchestrator'&&skill.clusters.includes('Riadenie'))||(skill.keywords?.some(word=>String(task).slice(0,12000).toLocaleLowerCase('sk').includes(word))));
}

export const AGENTS = groups.flatMap(([cluster, roles]) => roles.map(([id, name, role]) => ({
  id, name, cluster, role,
  tools: [...(id==='orchestrator'||['Vývoj','Cloud a prevádzka'].includes(cluster)?['project_inspect','project_read','improvement_submit','infrastructure_status','hosting_deploy','hosting_list','domain_search','domain_registration_status','domain_subdomain','domain_sync']:[]),'knowledge_search','plan_work','search_memory','project_snapshot','calculate','analyze_text','current_time','json_tool','hash_text','convert_units','extract_entities','format_text',...PRACTICAL_TOOL_NAMES,'list_capabilities','list_skills','list_connectors','install_plugin','execute_skill','copilot_chat','ecosystem_synthesize','ecosystem_search','quantum_deliberate','quantum_accelerate','brain_mode','brain_reflect','brain_memory','quantum_parallel','quantum_fusion','domain_check','domain_list','domain_inspect','domain_marketplace','domain_env_list','create_file','create_pdf','list_artifacts','read_artifact','trinity_doc_create','trinity_doc_list','ui_evolve','self_evolve','commodity_analyze','commodity_desk','generate_video','generate_music','generate_presentation','generate_creative_pack','cloudflare_manage','github_manage','firecrawl_scrape','firebase_manage','integration_status','wallet_terminals_status','terminal_charge','terminal_payout','wallet_create','delegate_worker','orchestrate_team','fleet_status','open_weather','open_wikipedia','network_dns','crypto_prices','tech_news','macro_data','free_modules_catalog', ...(['Výskum','Obchod a rast'].includes(cluster)||id==='orchestrator' ? ['web_search','web_fetch'] : []),
    ...(['ui','writer','orchestrator'].includes(id)?['generate_image']:[]),
    ...(['market-research','business-development','growth-analyst','orchestrator'].includes(id)?['portfolio_summary','commodity_trade','commodity_auto_invest']:[]),
    ...(['Riadenie','Cloud a prevádzka','Dáta a pamäť','Kvalita a bezpečnosť','Podpora a automatizácia'].includes(cluster) ? ['service_status'] : []),
    ...(['Cloud a prevádzka','Riadenie'].includes(cluster)||['backend','architect','cloudflare','orchestrator'].includes(id)?['domain_add','domain_register','domain_set_dns','domain_delete_dns','domain_env_provision','domain_env_deploy']:[]),
    ...(['Obchod a rast','Riadenie'].includes(cluster)||['business-development','offer-strategist','web-sales','growth-analyst','market-research','cloudflare','orchestrator'].includes(id)?['domain_list_for_sale','domain_sell','domain_list_for_lease','domain_lease','domain_end_lease','commerce_status','commerce_add_offer','monetization_blueprint']:[]),
    ...(id==='orchestrator'?['request_system_action','system_action_status','pc_screenshot','pc_run_script','pc_run','pc_file_read','pc_file_write','pc_file_append','pc_file_edit','pc_directory_create','pc_open_app','pc_app_control','pc_notify','pc_system_info','pc_scrape','pc_web_fetch','pc_download','pc_git_commit','pc_git_pr']:[]),
    ...(['backend','release','cloudflare'].includes(id)?['pc_git_commit','pc_git_pr','pc_run']:[])]
})));
export function agentById(id) { return AGENTS.find(a => a.id === id); }
export function shouldDelegate(task) {
  const normalized=task.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const action=/\b(sprav|vytvor|oprav|nasad|implementuj|vybuduj|priprav|analyzuj|preskumaj|otestuj|skontroluj|navrhni|vypracuj|create|build|fix|deploy|implement|analy[sz]e|research|test|review|design|prepare)\b/;
  return action.test(normalized)||task.length>=240;
}
export function selectTeam(task, mode = 'single', agent = 'auto') {
  let selected = agent;
  if (selected === 'auto') {
    const normalized = task.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    selected = /domena|domeny|domenu|dns|nameserver|tld|registracia domen/.test(normalized) ? 'cloudflare'
      : /cloudflare|worker|binding|deploy/.test(normalized) ? 'cloudflare'
      : /kod|code|python|javascript|program|api/.test(normalized) ? 'backend'
      : /komodit|zlat|striebr|platin|paladi|brent|wti|uran|liti|nikel|psenic|kukuric|kaka|invest|portfolio|akci|krypto|trh|trading|stock|crypto|commodity/.test(normalized) ? 'market-research'
      : /zakaznik|klient|lead|ponuk|predaj|webstrank|linkedin|outreach|zarob|prijem|trzb|revolut|paypal|platb|checkout|cennik|monetiz/.test(normalized) ? 'business-development'
      : /vyhlada|najdi|zdroj|research|vyskum/.test(normalized) ? 'researcher'
      : /text|napis|clanok|email/.test(normalized) ? 'writer'
      : /pamat|memory|databaz|sql/.test(normalized) ? 'database'
      : /bezpec|security|audit/.test(normalized) ? 'security' : 'orchestrator';
  }
  if (!agentById(selected)) throw new Error('Unknown agent');
  return mode === 'team' ? [...new Set(['planner', selected, 'qa', 'orchestrator'])] : [selected];
}

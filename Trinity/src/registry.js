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
export const SKILLS=[
  {id:'planning',name:'Plánovanie úloh',description:'Rozdeľ požiadavku na kroky, závislosti a overiteľné výsledky.',clusters:['Riadenie','Podpora a automatizácia']},
  {id:'secure-development',name:'Bezpečný vývoj',description:'Validuj vstupy, minimalizuj oprávnenia a pokrývaj hraničné prípady testami.',clusters:['Vývoj','Kvalita a bezpečnosť']},
  {id:'cloud-operations',name:'Cloud prevádzka',description:'Over bindingy, build a health endpointy; nasadenie vyžaduje samostatné schválenie.',clusters:['Cloud a prevádzka']},
  {id:'evidence-research',name:'Výskum s dôkazmi',description:'Oddeľ zdroje, fakty, odhady a neoverené predpoklady.',clusters:['Výskum','Dáta a pamäť']},
  {id:'integration-design',name:'Návrh integrácií',description:'Najprv over dostupný konektor a jeho oprávnenia; tajomstvá nikdy nevypisuj.',clusters:['Dáta a pamäť','Cloud a prevádzka']},
  {id:'quality-review',name:'Kontrola kvality',description:'Porovnaj výsledok s požiadavkami a uveď konkrétne zostávajúce riziká.',clusters:['Kvalita a bezpečnosť','Tvorba']},
  {id:'paper-trading',name:'Papierové obchodovanie',description:'Vedie simulované portfólio, investičný denník a rizikové limity bez použitia reálnych peňazí.',clusters:['Výskum','Dáta a pamäť','Kvalita a bezpečnosť']}
];
export const AGENTS = groups.flatMap(([cluster, roles]) => roles.map(([id, name, role]) => ({
  id, name, cluster, role,
  tools: ['search_memory','project_snapshot','calculate','analyze_text','current_time','json_tool','hash_text','convert_units','extract_entities','format_text','list_capabilities','list_skills','list_connectors','install_plugin', ...(['Výskum'].includes(cluster)||id==='orchestrator' ? ['web_search'] : []),
    ...(['ui','writer','orchestrator'].includes(id)?['generate_image']:[]),
    ...(['market-research','orchestrator'].includes(id)?['portfolio_summary']:[]),
    ...(['Riadenie','Cloud a prevádzka','Dáta a pamäť','Kvalita a bezpečnosť','Podpora a automatizácia'].includes(cluster) ? ['service_status'] : []),
    ...(id==='orchestrator'?['request_system_action','system_action_status','pc_screenshot','pc_run','pc_file_read','pc_file_write','pc_file_append','pc_file_edit','pc_directory_create','pc_open_app','pc_app_control','pc_notify','pc_system_info','pc_scrape','pc_web_fetch','pc_download','pc_git_commit','pc_git_pr']:[]),
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
    selected = /cloudflare|worker|binding|deploy/.test(normalized) ? 'cloudflare'
      : /kod|code|python|javascript|program|api/.test(normalized) ? 'backend'
      : /obchod|invest|portfolio|akci|krypto|trh|trading|stock|crypto/.test(normalized) ? 'market-research'
      : /vyhlada|najdi|zdroj|research|vyskum/.test(normalized) ? 'researcher'
      : /text|napis|clanok|email/.test(normalized) ? 'writer'
      : /pamat|memory|databaz|sql/.test(normalized) ? 'database'
      : /bezpec|security|audit/.test(normalized) ? 'security' : 'orchestrator';
  }
  if (!agentById(selected)) throw new Error('Unknown agent');
  return mode === 'team' ? [...new Set(['planner', selected, 'qa', 'orchestrator'])] : [selected];
}

// Rozšírený dôveryhodný katalóg Trinity. Položky používajú iba nástroje jadra.
const skillGroups = [
  ["delivery", "Dodanie", ["Rozsah", "Požiadavky", "Míľniky", "Závislosti", "Riziká", "Akceptácia", "Priority", "Backlog", "Stav", "Retrospektíva"], ["Riadenie", "Podpora a automatizácia"]],
  ["software", "Vývoj", ["API kontrakt", "Frontend obrazovka", "Backend služba", "Refaktoring", "Oprava chyby", "Databázová migrácia", "Testovací plán", "Výkonová optimalizácia", "Bezpečná implementácia", "Release balík"], ["Vývoj", "Kvalita a bezpečnosť"]],
  ["data", "Dáta", ["Návrh schémy", "Bezpečné SQL", "Čistenie záznamov", "CSV kontrola", "Metriky", "Štatistický prehľad", "Pôvod údajov", "Kontrola kvality", "Minimalizácia údajov", "Dátový report"], ["Dáta a pamäť", "Kvalita a bezpečnosť"]],
  ["cloud", "Cloud", ["Worker konfigurácia", "D1 databáza", "R2 artefakty", "KV cache", "Fronty", "Workflow", "Logy", "Health check", "Incident cloud", "Nákladový prehľad"], ["Cloud a prevádzka", "Vývoj"]],
  ["research", "Výskum", ["Webové hľadanie", "Výber zdrojov", "Dôkazová mapa", "Porovnanie možností", "Technická dokumentácia", "Overenie faktov", "Zhrnutie literatúry", "Trhový prehľad", "Časová os", "Výskumný report"], ["Výskum", "Dáta a pamäť"]],
  ["writing", "Text", ["Osnova", "Slovenský text", "Anglický text", "Technická dokumentácia", "Marketingový text", "Jazyková úprava", "Preklad", "Tón komunikácie", "SEO text", "Citácie"], ["Tvorba", "Výskum"]],
  ["design", "Dizajn", ["UX tok", "UI obrazovka", "Prístupné rozhranie", "Informačná architektúra", "Prototyp", "Vizuálny systém", "Content design", "Responzívne rozloženie", "Komponent", "Dizajnový audit"], ["Tvorba", "Kvalita a bezpečnosť"]],
  ["security", "Bezpečnosť", ["Model hrozieb", "Tajomstvá", "Prihlásenie", "Oprávnenia", "Validácia vstupov", "Ochrana súkromia", "Bezpečnostný audit", "Supply chain", "Incident response", "Obnova po útoku"], ["Kvalita a bezpečnosť", "Cloud a prevádzka"]],
  ["automation", "Automatizácia", ["Workflow", "Opakovanie", "Idempotencia", "Plánovanie behov", "Schvaľovanie", "Notifikácie", "Integrácia", "Import údajov", "Export údajov", "Automatizačný audit"], ["Podpora a automatizácia", "Cloud a prevádzka"]],
  ["support", "Podpora", ["Diagnostika", "Reprodukcia chyby", "Triage", "Koreňová príčina", "Runbook", "Odpoveď používateľovi", "Eskalácia", "FAQ", "Knowledge base", "Handoff"], ["Podpora a automatizácia", "Kvalita a bezpečnosť"]],
  ["finance", "Financie", ["Rozpočet", "Nákladový model", "Cashflow", "Papierové portfólio", "Rizikové limity", "Scenáre", "Daňový prehľad", "Faktúra", "Unit economics", "Finančný report"], ["Dáta a pamäť", "Výskum"]],
  ["personal", "Osobná organizácia", ["Úlohy", "Kalendár", "Návyky", "Poznámky", "Sústredenie", "Ciele", "Učenie", "Cestovanie", "Domácnosť", "Osobný prehľad"], ["Riadenie", "Dáta a pamäť"]],
  ["media", "Médiá", ["Brief obrázka", "Prompt obrázka", "Alternatívny text", "Video plán", "Obsahový kalendár", "Prepis", "Titulky", "Moderácia obsahu", "Brand asset", "Knižnica médií"], ["Tvorba", "Kvalita a bezpečnosť"]],
  ["quality", "Kvalita", ["Kontrolný zoznam", "Unit testy", "Regresia", "Hraničné prípady", "Peer review", "Dôkaz o výsledku", "Akceptačné testy", "QA dokumentácie", "QA prístupnosti", "Release gate"], ["Kvalita a bezpečnosť", "Podpora a automatizácia"]],
];

export const EXTENDED_SKILLS = skillGroups.flatMap(([key, category, names, clusters]) => names.map((name, index) => ({
  id: `${key}-${String(index + 1).padStart(2, '0')}`, name: `${category}: ${name}`, description: `${name}: vytvor konkrétny postup, uveď vstupy, overiteľný výstup a zostávajúce obmedzenia.`, clusters, keywords: [name.toLocaleLowerCase('sk'), category.toLocaleLowerCase('sk'), key], steps: [`zistiť vstupy a hranice pre ${name.toLocaleLowerCase('sk')}`, 'zvoliť iba dostupné a povolené nástroje', 'vykonať alebo pripraviť výsledok s označením stavu', 'skontrolovať výstup podľa akceptačných podmienok'], success_checks: ['výstup je spätne overiteľný', 'fakty, odhady a návrhy sú oddelené', 'bez vykonaného nástroja sa akcia neoznačí za dokončenú']})));

const pluginGroups = [
  ["productivity", "Produktivita", ["Inbox úloh", "Denná agenda", "Ciele", "Poznámky", "Focus plán", "Prioritizácia", "Checklisty"]],
  ["developer", "Vývoj", ["API kontrakty", "Kontrola kódu", "Diff súborov", "Release balík", "Závislosti", "Changelog", "Technické docs"]],
  ["data", "Dáta", ["JSON laboratórium", "CSV laboratórium", "Tabuľkové filtre", "Štatistiky", "Deduplikácia", "Redakcia údajov", "Schéma dát"]],
  ["cloud", "Cloud", ["Worker diagnostika", "D1 prehľad", "R2 archív", "KV prehľad", "Queue plán", "Workflow monitor", "Cloud health"]],
  ["research", "Výskum", ["Zdrojový radar", "Porovnanie zdrojov", "Dôkazová mapa", "Fact-check", "Technický čitateľ", "Trhový skener", "Výskumný archív"]],
  ["content", "Obsah", ["Markdown balík", "HTML čistič", "Prekladový balík", "Tón textu", "SEO kontrola", "Citácie", "Textový redaktor"]],
  ["design", "Dizajn", ["Farby", "Kontrast", "UI komponenty", "UX checklist", "Prompt obrázka", "Alt text", "Layout plán"]],
  ["security", "Bezpečnosť", ["Security headers", "Trezor tajomstiev", "Auth checklist", "Permission audit", "Input guard", "Privacy scrubber", "Audit dôkazov"]],
  ["automation", "Automatizácia", ["Workflow builder", "Retry plán", "Idempotency check", "Approval flow", "Notifikácie", "Import pipeline", "Export pipeline"]],
  ["support", "Podpora", ["Diagnostics", "Incident kit", "Runbook", "Ticket triage", "FAQ builder", "Handoff balík", "Status report"]],
  ["finance", "Financie", ["Budget board", "Kalkulácie", "Paper trading", "Scenáre", "Unit metrics", "Invoice helper", "Finance report"]],
  ["time", "Čas", ["Dátumová os", "Time zone", "Trvanie", "Pracovné dni", "Recurrence", "Clock board", "Deadline guard"]],
  ["integration", "Integrácie", ["MCP registry", "Connector check", "GitHub brief", "Cloudflare brief", "PC Bridge", "Email prep", "Webhook contract"]],
  ["media", "Médiá", ["Image brief", "Asset metadata", "Caption maker", "Transcript prep", "Moderation", "Brand kit", "Gallery index"]],
  ["planning", "Plánovanie", ["Roadmap", "Scope guard", "Risk register", "Backlog board", "Milestones", "Requirements", "Acceptance gate"]],
];

const pluginTools = ['plan_work','search_memory','project_snapshot','service_status','calculate','analyze_text','current_time','json_tool','hash_text','convert_units','extract_entities','format_text','date_math','timezone_convert','statistics','csv_inspect','csv_to_json','text_diff','list_cleaner','table_transform','url_inspect','query_string','color_convert','contrast_check','base64_codec','uuid_tool','semver_compare','redact_sensitive','markdown_inspect','html_to_text','business_math','geometry','web_search','generate_image','list_capabilities','list_skills','list_connectors'];
const icons = ['◇','◈','▦','◎','⌁','±','Aa','✓','↔','◉','Σ','▤','⇄','⌕','✳'];
export const EXTENDED_PLUGINS = pluginGroups.flatMap(([key, category, names], groupIndex) => names.map((name, index) => {
  const id = `${key}-pack-${String(index + 1).padStart(2, '0')}`;
  const tool = key === 'research' ? 'web_search' : key === 'design' && index === 4 ? 'generate_image' : pluginTools[(groupIndex * 7 + index) % pluginTools.length];
  const dependency = key === 'cloud' ? 'Cloudflare bindings' : key === 'developer' ? 'Trinity runtime' : key === 'data' ? 'Worker runtime' : key === 'integration' ? 'Authorized connector' : key === 'finance' ? 'D1 paper ledger' : 'Trinity core';
  return {id, name: `${category}: ${name}`, icon: icons[groupIndex], description: `Dôveryhodný balík pre ${name.toLocaleLowerCase('sk')}; používa existujúci nástroj ${tool} a neťahá ani nespúšťa externý kód.`, tools: [tool], dependency, version: '1.0.0', category: key, trusted: true};
}));

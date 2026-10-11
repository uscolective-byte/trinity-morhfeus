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

const specificWorkflows = {
  "software": {
    "steps": [
      "prečítať aktuálny zdroj a zachovať existujúce lokálne úpravy",
      "pripraviť najmenšiu cielenú zmenu pre tento vývojový postup",
      "spustiť dostupné testy a uložiť skutočné výsledky",
      "odovzdať rozdiel, obmedzenia a bezpečný ďalší krok"
    ],
    "success_checks": [
      "testy bez vykonania zostávajú označené ako neoverené",
      "žiadne tvrdenie o nasadení bez potvrdenia nasadenia"
    ]
  },
  "cloud": {
    "steps": [
      "rozlíšiť lokálne, preview a produkčné prostredie",
      "overiť aktuálnu konfiguráciu a odpoveď služby bez čítania tajomstiev",
      "pripraviť cielenú zmenu a postup návratu",
      "vykonať zmenu iba s príslušnou autorizáciou a overiť výsledok"
    ],
    "success_checks": [
      "HTTP 200 nie je dôkaz autorizovaného nástroja",
      "žiadne zamieňanie lokálnej a produkčnej databázy"
    ]
  },
  "quality": {
    "steps": [
      "určiť konkrétne požiadavky a akceptačné podmienky",
      "pokryť úspešný, chybový a hraničný prípad",
      "vykonať dostupnú kontrolu a zaznamenať výstup",
      "oddeliť úspešné testy od netestovaných závislostí"
    ],
    "success_checks": [
      "registrovaný nástroj sa nevydáva za úspešne otestovaný",
      "pri zlyhaní zostáva výsledok neúspešný alebo blokovaný"
    ]
  },
  "support": {
    "steps": [
      "zistiť konkrétnu chybu a prostredie bez požadovania kľúčov v chate",
      "overiť jednu neškodnú diagnostickú požiadavku",
      "opraviť príčinu namiesto opakovania rovnakého neúspešného kroku",
      "odovzdať stručný stav a najviac jeden potrebný krok používateľa"
    ],
    "success_checks": [
      "záver má skutočný dôkaz, nie iba staré hlásenie",
      "citlivé nastavenia sa nemenia len na zakrytie chyby"
    ]
  }
};
export const EXTENDED_SKILLS = skillGroups.flatMap(([key, category, names, clusters]) => names.map((name, index) => ({
  id: `${key}-${String(index + 1).padStart(2, '0')}`, name: `${category}: ${name}`, description: `${name}: vytvor konkrétny postup, uveď vstupy, overiteľný výstup a zostávajúce obmedzenia.`, clusters, keywords: [name.toLocaleLowerCase('sk'), category.toLocaleLowerCase('sk'), key], steps: [`zistiť vstupy a hranice pre ${name.toLocaleLowerCase('sk')}`, 'zvoliť iba dostupné a povolené nástroje', 'vykonať alebo pripraviť výsledok s označením stavu', 'skontrolovať výstup podľa akceptačných podmienok'], success_checks: ['výstup je spätne overiteľný', 'fakty, odhady a návrhy sú oddelené', 'bez vykonaného nástroja sa akcia neoznačí za dokončenú'], kind: 'workflow', ...(specificWorkflows[key]||{})})));

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

// Explicit shared-tool bundles; these are workflows, not new external integrations.
const pluginToolSets = {
  "productivity": [
    [
      "project_snapshot",
      "plan_work"
    ],
    [
      "current_time",
      "plan_work"
    ],
    [
      "plan_work"
    ],
    [
      "search_memory"
    ],
    [
      "plan_work"
    ],
    [
      "plan_work"
    ],
    [
      "markdown_inspect",
      "plan_work"
    ]
  ],
  "developer": [
    [
      "json_tool",
      "plan_work"
    ],
    [
      "text_diff",
      "plan_work"
    ],
    [
      "text_diff"
    ],
    [
      "semver_compare",
      "plan_work"
    ],
    [
      "semver_compare"
    ],
    [
      "text_diff",
      "markdown_inspect"
    ],
    [
      "markdown_inspect",
      "analyze_text"
    ]
  ],
  "data": [
    [
      "json_tool"
    ],
    [
      "csv_inspect",
      "csv_to_json"
    ],
    [
      "table_transform"
    ],
    [
      "statistics"
    ],
    [
      "list_cleaner"
    ],
    [
      "redact_sensitive"
    ],
    [
      "json_tool"
    ]
  ],
  "cloud": [
    [
      "service_status",
      "list_connectors"
    ],
    [
      "project_snapshot",
      "list_connectors"
    ],
    [
      "list_connectors"
    ],
    [
      "list_connectors"
    ],
    [
      "plan_work"
    ],
    [
      "service_status"
    ],
    [
      "service_status",
      "list_connectors"
    ]
  ],
  "research": [
    [
      "web_search"
    ],
    [
      "web_search",
      "plan_work"
    ],
    [
      "web_search",
      "plan_work"
    ],
    [
      "web_search"
    ],
    [
      "web_search"
    ],
    [
      "web_search"
    ],
    [
      "web_search",
      "project_snapshot"
    ]
  ],
  "content": [
    [
      "markdown_inspect"
    ],
    [
      "html_to_text"
    ],
    [
      "analyze_text"
    ],
    [
      "format_text",
      "analyze_text"
    ],
    [
      "analyze_text",
      "markdown_inspect"
    ],
    [
      "markdown_inspect"
    ],
    [
      "analyze_text",
      "text_diff"
    ]
  ],
  "design": [
    [
      "color_convert"
    ],
    [
      "contrast_check"
    ],
    [
      "plan_work"
    ],
    [
      "plan_work",
      "contrast_check"
    ],
    [
      "generate_image"
    ],
    [
      "analyze_text"
    ],
    [
      "plan_work"
    ]
  ],
  "security": [
    [
      "url_inspect",
      "plan_work"
    ],
    [
      "list_connectors"
    ],
    [
      "list_connectors",
      "plan_work"
    ],
    [
      "list_capabilities"
    ],
    [
      "json_tool"
    ],
    [
      "redact_sensitive"
    ],
    [
      "project_snapshot",
      "plan_work"
    ]
  ],
  "automation": [
    [
      "plan_work"
    ],
    [
      "plan_work"
    ],
    [
      "hash_text",
      "plan_work"
    ],
    [
      "list_capabilities",
      "plan_work"
    ],
    [
      "plan_work"
    ],
    [
      "csv_to_json",
      "json_tool"
    ],
    [
      "table_transform",
      "json_tool"
    ]
  ],
  "support": [
    [
      "service_status",
      "list_connectors"
    ],
    [
      "service_status",
      "plan_work"
    ],
    [
      "plan_work",
      "markdown_inspect"
    ],
    [
      "analyze_text",
      "plan_work"
    ],
    [
      "markdown_inspect"
    ],
    [
      "project_snapshot",
      "plan_work"
    ],
    [
      "project_snapshot",
      "current_time"
    ]
  ],
  "finance": [
    [
      "business_math"
    ],
    [
      "business_math"
    ],
    [
      "portfolio_summary"
    ],
    [
      "business_math"
    ],
    [
      "statistics",
      "business_math"
    ],
    [
      "business_math",
      "json_tool"
    ],
    [
      "portfolio_summary",
      "business_math"
    ]
  ],
  "time": [
    [
      "date_math"
    ],
    [
      "timezone_convert"
    ],
    [
      "date_math"
    ],
    [
      "date_math"
    ],
    [
      "plan_work",
      "date_math"
    ],
    [
      "current_time"
    ],
    [
      "date_math",
      "plan_work"
    ]
  ],
  "integration": [
    [
      "list_capabilities"
    ],
    [
      "list_connectors"
    ],
    [
      "plan_work"
    ],
    [
      "list_connectors"
    ],
    [
      "list_connectors"
    ],
    [
      "analyze_text",
      "plan_work"
    ],
    [
      "json_tool",
      "plan_work"
    ]
  ],
  "media": [
    [
      "plan_work"
    ],
    [
      "json_tool"
    ],
    [
      "analyze_text"
    ],
    [
      "analyze_text",
      "plan_work"
    ],
    [
      "redact_sensitive"
    ],
    [
      "plan_work"
    ],
    [
      "project_snapshot"
    ]
  ],
  "planning": [
    [
      "plan_work"
    ],
    [
      "plan_work"
    ],
    [
      "plan_work"
    ],
    [
      "project_snapshot",
      "plan_work"
    ],
    [
      "plan_work",
      "date_math"
    ],
    [
      "plan_work"
    ],
    [
      "plan_work"
    ]
  ]
};
const icons = ['◇','◈','▦','◎','⌁','±','Aa','✓','↔','◉','Σ','▤','⇄','⌕','✳'];
export const EXTENDED_PLUGINS = pluginGroups.flatMap(([key, category, names], groupIndex) => names.map((name, index) => {
  const id = `${key}-pack-${String(index + 1).padStart(2, '0')}`;
  const tools = pluginToolSets[key][index];
  const dependency = key === 'cloud' ? 'Cloudflare bindings' : key === 'developer' ? 'Trinity runtime' : key === 'data' ? 'Worker runtime' : key === 'integration' ? 'Authorized connector' : key === 'finance' ? 'D1 paper ledger' : 'Trinity core';
  return {id, name: `${category}: ${name}`, icon: icons[groupIndex], description: `Dôveryhodný balík pre ${name.toLocaleLowerCase('sk')}; používa iba zdieľané nástroje ${tools.join(", ")}. Samostatná integrácia ani vykonanie nie sú týmto balíkom potvrdené.`, tools, dependency, version: '1.0.0', category: key, trusted: true, kind: 'workflow-pack', external_code: false};
}));

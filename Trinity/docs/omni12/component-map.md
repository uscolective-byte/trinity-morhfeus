# Existujúca Trinity → roly a kontrakty OMNI-CORE 12.0

Pokračujeme v existujúcom projekte. Auditované snapshoty sú Antigravity `dee77b4342475c933bf9756c1f9ffa5183caf5f1` a Morhfeus `d273e7059974366439090feeb56b7826813849c1`; oba repozitáre zostávajú zachované. `components_map.json` obsahuje úplný inventár ich deklarovaných konfigurácií, služieb, agentových rolí a nástrojových schém. Deklarácia je `EXISTING`; prevádzková dostupnosť bez live dôkazu zostáva `NOT_TESTED`.

| Existujúci komponent | Cieľová rola | Kompatibilný kontrakt / zmena |
|---|---|---|
| `Trinity/src/orchestrator.js` | Control Plane: jediný logický koordinátor | Zachovať `delegateWorker`/`orchestratePipeline` aj katalóg bindingov. TAP wrapper pridáva identitu, task/run a riadený stav, nenahrádza worker dispatch. |
| `Trinity/src/registry.js` | Agent Registry: logické roly | Zachovať `AGENTS`, `agentById`, `selectTeam`; samostatná nová `TAP_AGENTS` politika má minimálne scopes. Rola nie je samostatná nasadená služba. |
| `Trinity/src/tools.js` | Tool Registry + Executor | Zachovať `TOOL_SCHEMAS` a `runTool(env,agent,name,input,executionContext)`, pôvodné validácie a owner/admin brány. Foundation facade povoľuje iba `diagnostic_ping`. |
| `Trinity/src/mcp.js`, `skillRegistry.js` | MCP Hub a skill adaptéry | Zachovať existujúce registrácie a transport. TAP neduplikuje MCP a ešte nie je napojený na HTTP/MCP host. |
| `Trinity/src/engine.js` | Agent Runtime | Zachovať `runAgent` a výber existujúcich nástrojov/modelov; nové TAP volania sú oddelený opt-in vstup. |
| `Trinity/src/workflow.js` | Workflow Engine / Task Manager | Zachovať `ops_jobs`/`ops_steps`/`ops_events`. Nové stavy majú vlastnú schému, nemenia legacy DB enum. |
| `Trinity/src/truth.js`, `services/guardian.js`, `legacy.js` | Data & Trust Plane / Guardian | Zachovať truth/health/ACK komponenty. Nový dôkazový gate overuje konkrétny výsledok a D1/R2 obsah; nezamieňa exitCode, health či ACK s dôkazom vykonania. |
| `Trinity/src/tools.js` — `diagnostic_ping` | Diagnostický integračný nástroj | V Antigravity už existuje a volá sa priamo cez `runTool`; v auditovanom Morhfeus snapshote chýba. Žiadna nová duplicita endpointu. |
| D1/R2 v `Trinity/wrangler.jsonc` | L2 Structured / L4 Artifacts | Staré bindings bez zmeny. Nový kontrakt vyžaduje nezávislé `TAP_DB`/`TAP_ARTIFACTS`, navrhnuté tabuľky sú iba v dokumentácii a lokálnych testoch. |
| `memory-context.js`, `graph-memory.js`, `teleological_memory.js`, Durable Objects | L0 context / L1 working / L2–L3 memory | Zachovať sanitizáciu a provenance. KV katalóg/cache nie je nový autoritatívny zámok. Nový TAP claim používa D1. |
| `Local-Gateway/src/server.mjs`, `executor.mjs`, `policy.mjs`, `store.mjs` | Windows execution gateway | Zachovať loopback 8791, bearer auth, capability allowlist, schvaľovanie, safe paths a hash preconditions. Nepridávať internetový shell. |
| `Trinity/src/system-actions.js`, `PC-Bridge-Worker/src/index.js` | Cloud ↔ PC Bridge | Zachovať heartbeat, claim a receipt callback. Mutujúce TAP úlohy zatiaľ nepovoľovať; lease retry potrebuje reconciliation. |
| `Trinity/src/services.js`, `ai-providers.js` | Model Router | Reuse existujúcich Workers AI/OpenAI/Gemini/Ollama adaptérov; tento rez ich nenahrádza a netvrdí live auth. Azure/Cohere zostávajú ďalšou etapou. |
| Existujúci `meta-connector.js` | Meta Facebook/Instagram OAuth integrácia | Zachovať. Tento konektor nie je doklad pripojenia Meta AI agenta. |
| Nová logická identita `auru-dev-agent` | Meta AI člen tímu podľa zadania vlastníka | Zapísaná oddelene v `TAP_AGENTS`; `NOT_TESTED`, protokol `UNVERIFIED`, transport nenájdený, scopes a verified capabilities prázdne. Produkčné práva žiadne. |

## Nový opt-in kontrakt

`packages/contracts/src/tap.js` definuje `trinity.agent.v1` / `1.0.0`: `task_id`, `run_id`, message/trace identifikátory, sender/receiver, prostredie, stav, payload, authorization ref, idempotency key, result, evidence a error. Obsahuje legacy adaptér, ktorý nikdy nepreberá staré tvrdenie o `VERIFIED` ako dôkaz. TypeScript deklarácie a generovaná JSON Schema slúžia ďalším hostom bez presunu projektu na nový framework.

`Trinity/src/tap-runtime.js` tvorí reťazec `server principal + grant → TAP validácia → scope → D1 claim → existujúci Registry/runTool/diagnostic_ping → kontrola výsledku → R2 a D1 read-back → VERIFIED`. Zdvojené alebo prerušené behy sa slepo neopakujú. `UNKNOWN_OUTCOME` vyžaduje reconciliation. SHA-256 viaže request a result; autentifikácia externého emitenta zostáva úlohou dôveryhodného host transportu, nie samotného checksumu.

## Prostredia a skutočný rozsah overenia

V auditovanej Antigravity konfigurácii patrí **auru.dev aj auru.space predvolenému produkčnému workeru**. Cieľ zadania, v ktorom má auru.dev znamenať staging alebo zdroj nového agenta, je budúca integrácia. Tento rozdiel sa nesmie vyriešiť iba názvom v manifeste. Routy, bindings, tajomstvá a produkcia v tejto etape ostávajú bez zmeny.

Foundation kontrakt a diagnostická facade sú lokálne testované vrátane Miniflare D1/R2. Neexistuje nové tvrdenie o produkčnom nasadení, autentifikovanom Meta pripojení, novej dostupnosti providerov ani verejnom R2 receipte. Existujúce rozpracované Local Gateway, Desktop a necommitnutý `packages/trinity-guardian` zostávajú mimo tohto diffu.

Konkrétne nedostatky a ďalšie etapy: `issues_report.md`. Strojová mapa vrátane úplných SHA, service bindings a porovnania súborov: `components_map.json`.

# Architektúra Trinity — stav zdrojov k 3. novembru 2026

Kanonický GitHub: https://github.com/uscolective-byte/Trinity-antigravity

Stabilný lokálny checkout: `C:\Users\saboi\Trinity\Trinity-antigravity`.
Kompatibilná cesta: `C:\Users\saboi\Trinity-antigravity` cez junction.
Zdrojový základ tejto inventúry: `b03ee6f730eaaf251c50931e6a5ed06b2a6a20a8`; lokálna oprava MCP je v commite `b4783e1b49a4c3cf6be58767b06b41b8b23bf8e3` a PR35.
Verzia aplikácie podľa `Trinity/src/version.js`: **11.1.0**.

Tento dokument mapuje implementáciu a konfiguráciu v repozitári. Prítomnosť súboru, modulu alebo bindingu nepotvrdzuje živé nasadenie, úspešné prihlásenie ani funkčnosť externého účtu.

## 1. Celkový tok

```text
Používateľ / prehliadač / PWA / externý AI klient
                |
    webová autentifikácia alebo MCP autorizácia
                |
  Cloudflare Access, ak chráni príslušnú doménu
                |
       Trinity Worker: src/index.js
       |            |                |
  Chat / REST    MCP JSON-RPC    Systémové akcie
       |            |                |
  routing -> planner -> engine -> tools / workflow
       |            |                |
  AI poskytovateľ   |       schválenie + gateway + executor
       |            |                |
       +------ D1 / KV / R2 / Vectorize / audit ------+
                    |
             výsledok + dôkazy
                    |
          pravdivostný filter -> odpoveď v chate
```

Samostatná lokálna cesta: Codex -> `trinity-local` -> stdio -> `trinity-mcp-bridge/server.mjs`. Táto cesta nepotrebuje vzdialený HTTP handshake.

## 2. Používateľské rozhrania

| Časť | Zdroj | Úloha |
|---|---|---|
| Hlavný chat | `Trinity/public/assistant/chat.html`, `chat.js.txt`, `chat.css` | Správy, história rozhovorov, výber enginu, zastavenie odpovede, prílohy, hlas |
| Vzhľad | `garage.css`, `theme.css`, `builder.css`, `mobile.css` | Garážový vizuál, témy, Studio, responzívne rozloženie |
| PWA a zariadenia | `manifest.json`, `sw.js.txt`, `mobile-device.js.txt`, `src/mobile-assets.js` | Inštalovateľná aplikácia a podpora zariadení |
| Samostatný mobilný chat | `src/mobile-chat.js` | Alternatívne mobilné HTML rozhranie |
| Technické centrum | `Trinity/public/index.html`, `app.js.txt`, `style.css` | Prevádzkové a administrátorské rozhranie |
| Omni-Dev Studio | hlavný chatový frontend a `src/developer-hub.js` | Editor, terminál, súbory, nástroje a diagnostika |
| AI Studio | `src/studio.js`, `studio-review.js` | Generovanie a revízie webov, náhľad a hodnotenie |

Frontend sa balí do hlavného Workera cez importy v `src/index.js`; samotná zmena lokálneho JS nemení verejnú stránku bez nasadenia.

## 3. HTTP jadro a hranice API

`Trinity/src/index.js` je hlavný HTTP router a integračný bod. Prepája autentifikáciu, frontendové assety, chat, joby, MCP, dokumenty, systémy akcií a doménové API.

- `/api/assistant/...`: chat, sessions/history a používateľské funkcie.
- `/api/ops/...`: joby a prevádzkové operácie vrátane stavov a rušenia.
- `/mcp`: vzdialené JSON-RPC MCP cez `src/mcp.js`.
- `/api/mcp/invoke`: existujúca priama cesta nástrojových volaní; osobitná od MCP transportu.
- `/api/system/actions...`: návrhy a životný cyklus systémových akcií.
- `/health`, `/ready`: prevádzkové údaje a readiness; nenahrádzajú autentifikovaný MCP test.

Presné povolené metódy a scopes určuje router a autorizačné moduly, nie tento prehľad.

## 4. Spracovanie rozhovoru

1. Frontend odošle správu, session ID, jazyk a vybraný engine.
2. `chat-routing.js` normalizuje výber a rozhoduje medzi rýchlou konverzáciou a ďalšími cestami.
3. `planner.js` a registry určujú zámer, schopnosti a prípadné delegovanie.
4. `engine.js` zostaví kontext a nástrojové oprávnenia a volá model alebo deterministický nástroj.
5. `tools.js` vykoná konkrétne dostupné volanie; záznamy o výsledku vstupujú do truth/evidence spracovania.
6. Odpoveď sa doručí cez stream udalostí alebo cez job, ktorého stav frontend priebežne číta.
7. Konverzácia používa sessions/history a pamäť; pracovný priebeh sa zobrazuje oddelene od odpovede.

`fast-chat.js` obsahuje rýchle pravidlá rozpoznávania jednoduchých požiadaviek, množinu nástrojov a pokyny pre stručnú konverzáciu. Nie je samostatným dôkazom vykonania akcie.

## 5. AI a inference

Relevantné moduly: `services.js`, `ai-providers.js`, `chat-routing.js`, `cognition.js`, `model-action-parser.js`, `circuit-breaker-router.js`, `pentad-circuit-breaker.js`.

V routingu sú implementované voľby `auto`, `cloud`, `fast`, `gemini`, `openai`, `ollama`, `local`, `deepseek-r1`, `llama`, `qwen`, `groq`, `deepseek`, `anthropic`, `mistral`, `openrouter`. Alias `codex` sa mapuje na OpenAI a `edge` na Workers AI. Názov voľby neznamená, že poskytovateľ má aktuálne dostupné poverenie.

`Trinity/services/chat-inference.js` je súkromný inference Worker: prijíma obmedzené požiadavky na `/generate`, overuje role a veľkosti správ a povoľuje nakonfigurované modely. Predvolené modelové identifikátory v tomto súbore sú Llama 3.1 8B a Llama 3.3 70B. Neurčuje to univerzálne aktívny model každej konverzácie.

## 6. Orchestrácia, agenti a workflow

| Modul | Zodpovednosť |
|---|---|
| `registry.js`, `skillRegistry.js` | Definície rolí, schopností a výber tímu |
| `planner.js`, `orchestrator.js`, `engine.js` | Plánovanie, smerovanie a vykonávací cyklus |
| `jobs.js`, `workflow.js` | Úlohy, stavy a odolné pracovné postupy |
| `control.js` | Prevádzkové riadenie a zastavenie |
| `plugins.js`, `skill-matrix.js`, `tools.js` | Katalóg, zapnutie a vykonanie nástrojov |
| `sovereign-core-v3.js` | Ledger, budget manager, konsenzus, provenance, replay a kernelové abstrakcie |
| `tap-runtime.js`, `tap-mcp-adapter.js` | Kontrakt akcií a adaptácia na MCP |

`legacy.js` exportuje Durable Object triedy `TrinityAgent`, `ChatAgent`, `GuardianAgent`; workflow trieda `TrinityOperations` je exportovaná hlavným entrypointom.

Deklarované počty rolí, skillov, pluginov a Workerov sa v dokumentoch líšia. Runtime počty treba získavať z aktuálneho katalógu; nie sú počtom nezávislých procesov, ktoré určite bežia.

## 7. Cloudové služby a Workery

Repozitár obsahuje tieto samostatné časti:

- `Trinity/`: hlavná aplikácia a konfigurácie pre chat, ops, guardian, knowledge a integrations.
- `Audit-Worker/`: auditná služba.
- `Capacity-Worker/`: kapacitné riadenie; konfigurácia deklaruje Durable Object `CapacityLedger`.
- `Knowledge-Worker/`: znalostné úložisko; konfigurácia deklaruje `KnowledgeStore`.
- `Integrations-Worker/`: integračná služba.
- `Jericho-Worker/`: samostatný Worker s produkčnou a historickou development konfiguráciou.
- `PC-Bridge-Worker/`: cloudová časť prepojenia s PC.
- `packages/trinity-guardian/`: ďalšia implementácia Guardian služby.
- `Trinity/services/`: `core`, `dispatcher`, `builder`, `guardian`, `sentinel`, `memory`, `skills`, `connectors`, `knowledge-api`, `integration-providers`, `internal-auth`, `worker-runtime`, proxy a entrypointy.

Konfigurácie obsahujú aj AURA service-binding roly analyzer, architect, codegen, deployer, evolver, memory, optimizer, planner, sentinel a tester. Ich zmienka v konfigurácii nie je živý health výsledok.

## 8. Dáta a pamäť

| Technológia | Architektonická úloha |
|---|---|
| Cloudflare D1 | Trvalé relačné dáta, pamäť, sessions/job záznamy, akcie, audit a ledger podľa migrácií |
| KV | Cache, pracovný kontext a stavové mapy; konfigurácie obsahujú `TRINITY_KV`, `Mastermind`, `PC_STATE` |
| R2 | Artefakty, dokumenty a médiá; historické konfigurácie používajú aliasy nad `trinity-artifacts` |
| Vectorize | Vektorové vyhľadávanie; konfigurácie obsahujú `VECTOR_INDEX`, `VECTORIZE`, `AURA_MEMORY_VECTOR` |
| Durable Objects | Stateful agenti a špecializované služby |
| Lokálne úložisko | Stav gateway a lokálne záznamy; nejde o cloudovú D1 |

Pamäťové moduly: `memory-context.js`, `memorySkill.js`, `graph-memory.js`, `shared-notes.js`, `brain.js`, `teleological_memory.js` a súvisiace migrácie v `Trinity/migrations/`.

Konfiguračné súbory obsahujú viac aliasov a staršie prostredia. Ich existencia nepotvrdzuje izoláciu stagingu ani zhodu živých databáz.

## 9. Lokálny počítač

`Local-Gateway/` je Node.js aplikácia (package deklaruje Node >=22). Obsahuje:

- `server.mjs`: lokálnu bránu;
- `system-bridge.mjs`: systémový bridge;
- `executor.mjs`, `local-action-dispatcher.mjs`: dispatch a vykonávanie;
- `policy.mjs`, `trinity-auth-core.mjs`: lokálne bezpečnostné hranice;
- `script-command.mjs`, `process-command.mjs`: skriptové a procesné operácie;
- `desktop.mjs`, `developer-tools.mjs`: desktopové a vývojové schopnosti;
- `bridge-heartbeat.mjs`, `cloud-link.mjs`: stavové a cloudové prepojenie;
- `store.mjs`: lokálny stav;
- `trinity123/`: lokálny agent a CLI.

Dokumentácia uvádza porty 7788 pre systémový most a 8791 pre gateway; skutočný port závisí od konfigurácie konkrétneho procesu. Ďalšia desktopová časť je v `Local-Desktop/`.

## 10. MCP a externí AI účastníci

**Lokálny server `trinity-local`:** `trinity-mcp-bridge/server.mjs`, SDK MCP v1, stdio cez `MCP_STDIO=true`. Nástroje: `trinity_bridge_status`, `trinity_cmd`, `trinity_wrangler`. HTTP režim je samostatný a v zdroji používa loopback port 3333. Oprava PR35 oddeľuje stdio štart od HTTP listenera a jeho tokenu.

**Vzdialený server `trinity`:** `https://auru.space/mcp`, JSON-RPC a bearer poverenie `TRINITY_MCP_API_KEY`. Cloudflare Access môže byť ďalšou samostatnou autorizačnou vrstvou.

**Alternatívny bezpečný proxy launcher:** `Trinity/scripts/trinity-codex-mcp.mjs` a `start-trinity-codex-mcp.ps1`; ide o inú cestu než lokálny všeobecný bridge.

**Klienti:** Codex, ChatGPT, Antigravity, Gemini a GitHub Copilot majú vlastné hostiteľské relácie a konfigurácie. Microsoft Copilot Studio a interný `TrinityCopilotAgent` nie sú GitHub Copilot. Konfigurácia servera neznamená ACK druhého klienta.

Tímový lokálny pomocník mimo Git checkoutu: `C:\Users\saboi\Trinity\core\trinity-team-bridge.ps1`.

## 11. Bezpečnosť a pravdivosť

- Webová identita: `security.js`, `google-auth.js`, `webauthn.js`, auth bootstrap.
- API kľúče a scopes: `api-keys.js`, `mcp.js`, router.
- Tajomstvá: `secret-vault.js`, `trinity-master-secrets.js`, Secrets Store bindingy podľa konfigurácie.
- Lokálna a cloudová bridge autorizácia: `bridge-proxy-auth.js`, `packages/contracts/src/bridge-auth.js` a gateway.
- Systémové akcie: návrh, schválenie, vykonanie a dokončenie cez `system-actions.js`.
- Truth a evidence: `truth.js`, `evidence-response-filter.js`, `verified-response-formatters.js`, receipt a životný cyklus.
- Audit a ledger: `audit-log.js`, `sovereign-core-v3.js`, provenance a replay.
- Riadené zmeny: `sovereign-lock.js`, `self-improvement.js`, `self-evolution.js`, `ui-evolution.js`.

Implementované ochrany treba testovať na konkrétnej ceste. Regex blacklist v lokálnom shell moste sám nie je OS sandbox. Dokumentačný výraz „Ring 0“ sám nepotvrdzuje hardvérovú alebo kernelovú izoláciu. Stav `ready` lokálneho bridge nepotvrdzuje cloudový deployment ani oprávnenia externých účtov.

## 12. Produktové a integračné moduly

- Web a výskum: `web-access.js`, Firecrawl integrácia, `free-modules.js`.
- GitHub, Cloudflare, Firebase: `external-integrations.js` a samostatné integračné služby.
- Dokumenty a súbory: `trinity-documents.js`, `artifacts.js`, `media.js`.
- Multimédiá a hlas: `multimedia-studio.js`, `voice-agent.js`, `trinity2.js`.
- Domény a hosting: `domains.js`, `domain-environments.js`, `infrastructure.js`, `domain-desk-advanced.js`.
- Platby a obchod: `revolut.js`, `paypal-rest.js`, `wallet.js`, `wallet-terminals.js`, `finance-gateway.js`.
- Trhy a portfóliá: `market-data.js`, `trading.js`, `commodities-engine.js`, `banking-connectors.js`.
- Komunikácia: `telegram-bridge.js`, `email.js`, `meta-connector.js`.
- Agent sandbox, API builder, plánovanie a developer hub majú vlastné moduly.

Tento zoznam opisuje integračné adaptéry. Neznamená, že sú účty pripojené alebo že sa uskutočnila platba či obchod.

## 13. Kontrakty, testy a publikovanie

`packages/contracts/` obsahuje zdieľané kontrakty vrátane TAP a bridge autentifikácie. Testy sú v `Trinity/tests/`, `Local-Gateway/tests/`, koreňovom `tests/` a v jednotlivých službách. Lokálny MCP má vlastné `trinity-mcp-bridge/test/`.

Vývoj a release: `scripts/run-all-tests.mjs`, `SYNC-BUILD.ps1`, `scripts/deploy-all-workers.mjs`, synchronizácia release dokumentov, `Trinity/scripts/secrets-store-doctor.mjs` a `verify-deployment.mjs`.

GitHub Actions obsahujú build, CodeQL, dependency security, integračné kontroly, runner smoke, kontrakty a ďalšie workflow. Zelené lokálne testy nenahrádzajú hosted CI a staging dôkaz.

Koordinácia: `AGENTS.md` -> `TEAM-HANDOFF.md` -> CLAIM -> úprava -> testy -> UPDATE/HANDOFF -> vlastné ACK príjemcu. Produkčné nasadenie a merge podliehajú existujúcim release pravidlám.

## 14. Dôležité rozdiely a aktuálne overenie

1. `ARCHITECTURE.md` je starší návrhový opis 7 vrstiev a uvádza v11.0.0; aktuálny zdrojový version modul je 11.1.0.
2. Súbežne existujú koreňové, legacy a špecializované konfigurácie. Nemožno ich zrátať ako počet aktívnych produkčných Workerov.
3. Kontrolovaný `Trinity/wrangler.jsonc` v základe b03ee6f končí po sekcii triggers čiarkou bez uzavretia koreňového objektu. Tento konkrétny súbor nie je kompletný JSONC deployment manifest. Nie je preto správne tvrdiť, že aktuálny celý source build je v tejto kontrole overený. Ostatné konfigurácie treba posudzovať osobitne.
4. Lokálny stdio MCP: initialize, tools/list a trinity_bridge_status boli reálne overené; výsledok ready.
5. Vzdialený MCP: posledné naše overenie skončilo HTTP302 na Cloudflare Access; vzdialené tools/list a trinity_status neboli vykonané.
6. ACK Antigravity `AG-ACK-MCP-20261103` a kanonická junction cesta boli prečítané a overené. ACK nie je náhradou za úspešný vzdialený handshake.
7. PR35: lokálna stdio oprava publikovaná, lokálne 16/16 bridge testov PASS; posledné skontrolované hosted build a CodeQL kontroly hlásili failure, príčina nebola potvrdená.
8. Rozpracované zlepšenie chatu je v samostatnom worktree `work/chat-communication`; nejde automaticky o zmenu verejnej stránky.

## 15. Čo teraz najviac ovplyvňuje kvalitu chatu

Použiteľnosť neurčuje iba model. Treba súčasne udržať správny intent routing, spoľahlivý stream parser, zachovanie rozpracovaného textu, stabilnú históriu sessions, čitateľné výsledky nástrojov, rešpektovanie používateľovho scrollu a dôsledné odlíšenie vložených tvrdení od vlastných vykonaných kontrol.

Príklad s vymysleným `TRINITY_LEDGER.md` a `trinity-ledger-hub` nie je dôkazom, že treba zaviesť ďalší ledger alebo Worker. Existujúci systém už obsahuje ledgerové moduly; nový zásah musí vychádzať z konkrétneho zadania a aktuálneho overenia.

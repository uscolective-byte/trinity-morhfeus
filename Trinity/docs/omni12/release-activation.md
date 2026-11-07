# Schválené napojenie a nasadenie TAP diagnostiky

Vlastník po lokálnom Foundation handoffe výslovne zadal build a nasadenie. Tento nadväzujúci commit aktivuje pripravený kontrakt na existujúcej MCP ceste. Nejde o nový projekt ani náhradu starej Trinity.

## Prístup

`POST /mcp`, existujúci `tools/call` s názvom `diagnostic_ping`:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"diagnostic_ping","arguments":{"message":"ping","idempotency_key":"531af358-19b1-4de5-9748-385100c998bc"}}}
```

Používa existujúcu Cloudflare Access ochranu a Trinity autorizáciu. Scoped API klient potrebuje existujúci scope `mcp:write`; read-only klient nedostane právo vykonať diagnostiku. Pri browser owner/admin relácii hostiteľ odovzdáva svoje overené projectControl a principal. Žiadny grant, principal, prostredie ani scope sa nepreberá z argumentov nástroja.

`idempotency_key` je voliteľné UUID. Pri opakovaní rovnakého kľúča, textu, identity a prostredia sa zrekonštruuje ten istý celý envelope a vykonanie sa neopakuje. Zmena textu pri rovnakom kľúči je konflikt; iná identita má samostatný beh. Bez kľúča každé volanie zámerne vytvorí nové vykonanie.

Úspešný výsledok zachová healthy, echo a receipt_id. Pridá `tap` (task.result vrátane dôkazu) a `tap_request` na samostatné overenie request_hash. UNKNOWN_OUTCOME/FAILED je MCP isError, nie healthy. Pri aktivovanom TAP a chýbajúcom úložisku nie je legacy fallback.

## Produkcia a úložiská

- Serverový flag `TRINITY_TAP_ENABLED=true` zapína TAP diagnostiku.
- Produkcia navyše vyžaduje `TRINITY_TAP_PRODUCTION=diagnostic-only`.
- Produkčná D1 `trinity-tap-production` / R2 `trinity-tap-evidence-production`.
- Staging D1 `trinity-tap-staging` / R2 `trinity-tap-evidence-staging`.
- Existujúce DB/R2 zostávajú zachované. Schéma sa aplikovala iba na nové TAP DB, bez legacy migrácií.
- Auru.space aj auru.dev zostávajú produkčnými doménami rovnakého Workeru. Staging sa overuje na samostatnom trinity-staging workers.dev bez routes/crons. Release staging config odoberá produkčné service a Vectorize bindings a explicitne nastavuje runtime namiesto predvoleného build-only.

`auru-dev-agent` ostáva oddelená deklarovaná Meta identita, NOT_TESTED a bez scope/transportu. Nasadenie diagnostiky nie je jej prihlásenie ani aktivácia ďalších providerov.

## Testovanie a release dôkazy

Contracts6, Foundation21, skutočný HTTP/MCP host5 a Wrangler2: nezávislé fokusované testy sú súčasťou review. Celý workspace gate zahŕňa aj contracts a schema check. Nové CI najprv nainštaluje contracts, potom zostaví Worker a spustí aj HTTP testy; existujúce CI buildy dostali rovnaký prerequisite.

Release vyžaduje čistý commit, presný SHA tag, úspešný izolovaný staging MCP beh, D1/R2 remote read-back, idempotentný replay a revokáciu dočasného testovacieho credentialu. Až potom sa nasadzuje trinity. Finálny report uvádza skutočné Version ID a run/task/receipt; úspešný build sám nie je live dôkaz.

Cloudflare self-deploy je iba manuálny a auto-merge je vypnutý. Publikovanie kódu samo neautorizuje ďalší produkčný rollout. Cloudflare Access/IAM, existujúce permanentné credentials a cudzie rozpracované moduly sa nemenili. Rollback používa pred nasadením zaznamenanú predchádzajúcu Worker Version ID; D1/R2 dôkazy sú oddelené od aplikačných dát.

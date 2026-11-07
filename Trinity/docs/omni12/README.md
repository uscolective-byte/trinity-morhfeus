# Trinity OMNI-CORE 12.0 — Foundation, prvá kompatibilná etapa

Základ: `uscolective-byte/Trinity-antigravity@dee77b4342475c933bf9756c1f9ffa5183caf5f1`.
Auditovaný Morpheus: `uscolective-byte/trinity-morhfeus@d273e7059974366439090feeb56b7826813849c1`.
Mapa a nálezy sú v `components_map.json`, `component-map.md`, `issues_report.md`.

Nadväzujúci release: vlastník výslovne schválil nasadenie. Existujúci MCP `diagnostic_ping` je teraz napojený cez `tap-mcp-adapter.js`; podrobnosti konfigurácie a hranice nasadenia sú v `release-activation.md`. Pôvodný audit zachytáva stav pred touto aktiváciou.

## Čo je implementované

- `packages/contracts`: TAP 1.0 / verzia kontraktu 1.0.0, Zod validácia, JSON Schema, TypeScript deklarácie, legacy adaptér a stavový automat.
- `Trinity/src/tap-runtime.js`: voliteľný vstup do existujúceho `agentById` / `TOOL_SCHEMAS` / `runTool`. Jediný povolený nástroj je existujúci `diagnostic_ping`; žiadny duplicitný endpoint.
- Samostatná permission politika pre TAP, kontrola serverovej identity, expirovateľného grantu, príjemcu, prostredia a presného scope. Staré široké zoznamy nástrojov nedávajú automatické oprávnenie v TAP.
- D1 unikátny claim pred vykonaním, atomický stav a audit, SHA-256 nad kanonickým requestom/výsledkom/receiptom, podmienený R2 zápis a spätné overenie D1 aj R2 pred VERIFIED.
- Bezpečný replay toho istého obalu. Rovnaký idempotency key s odlišným obalom je konflikt. Nedokončený beh/timeout/chyba dôkazov znamená UNKNOWN_OUTCOME bez opätovného vykonania. Reconciliation vyžaduje budúci samostatný postup.
- Nová jediná logická identita `auru-dev-agent`: majiteľ uvádza Meta AI, zdroj auru.dev, NOT_TESTED, žiadny transport, overené schopnosti ani scope. Toto nie je zaregistrovaný živý provider ani nové prihlásenie.
- Nové CI iba testuje kontrakty a lokálny integračný reťazec; nemá deploy ani write permissions.

Projekt zostáva natívne JavaScript/ESM. Nevynucuje sa prechod na TypeScript, pnpm ani monorepo presun. Existujúce adaptéry Model Routera, port 8791, UI, databázové migrácie a rozhrania sa nemenia.

## Spustenie lokálne

Z koreňa tejto izolovanej vetvy (PowerShell, žiadne kľúče netreba):

```powershell
npm.cmd --prefix packages/contracts ci --ignore-scripts
npm.cmd --prefix Trinity ci --ignore-scripts
npm.cmd --prefix packages/contracts test
npm.cmd --prefix packages/contracts run schema:check
Push-Location Trinity
node --test tests/tap-foundation.test.mjs
Pop-Location
node Trinity/docs/omni12/run-local-proof.mjs <adresar-lokalnych-dokazov>
```

Výsledok demo obsahuje request/outcome/receipt/audit/summary JSON. Nástroj sa skutočne vykoná cez pôvodný Executor; D1 a R2 sú lokálne emulované Miniflare, nie vzdialený Cloudflare. `summary.json` tento rozsah výslovne uvádza.

## Hranice dôvery a kompatibility

Existujúci MCP `diagnostic_ping` používa nový adaptér, keď je serverový `TRINITY_TAP_ENABLED=true`. Pôvodné polia healthy/echo/receipt zostávajú; pridáva sa TAP obal a request na overenie hashu. Ostatné staré nástrojové cesty si zachovávajú existujúce správanie a nové bezpečnostné pravidlá sa na ne automaticky nerozšírili.

`executeTapTask(env, envelope, context)` vyžaduje **serverom vytvorený** context. `principal.authenticated`, grant a scopes nikdy nekopírovať z tela HTTP požiadavky alebo modelovej odpovede. `authorization_ref` je odkaz na grant, nie credential. Samotný validný JSON, názov domény, model alebo používateľský text nedokazuje identitu.

Produkcia vyžaduje okrem platného serverového grantu explicitný `TRINITY_TAP_PRODUCTION=diagnostic-only`. Povolený je iba diagnostic_ping, nie shell, deploy, finančné alebo iné mutujúce nástroje. Konfigurácia má samostatné `TAP_DB` a `TAP_ARTIFACTS` pre staging a produkciu. Legacy `DB`, R2, credentials a service bindings sa do diagnostického nástroja nededia; jeho voliteľný starý ops_events audit používa iba TAP_DB a nie je dôkazovou bránou. Nové TAP audit/evidence tabuľky sú povinné. Fyzické úložiská boli pred release vytvorené oddelene; živý read-back je samostatný release dôkaz.

`tap-foundation.sql` je mimo automatických legacy migrácií. Pri schválenom release sa aplikuje iba na nové dedikované TAP databázy. Používa nové tabuľky `tap_runs`, `tap_audit_events`, `tap_evidence_receipts` bez zásahu do starých tabuliek. Diagnostic runs sú riadky `tap_runs` s audit tool_id=diagnostic_ping; nezavádza sa paralelný task store `diagnostic_runs`.

SHA-256 overuje integritu a väzbu dát. Nie je podpisom poskytovateľa ani dôkazom nezávislej vzdialenej identity. Dôveruje sa lokálnemu Executor runtime a izolovanému úložisku. Útočník s právom prepísať oba stores môže dôkazy nanovo vypočítať; podpisy/attestácia a retenčná politika sú budúca etapa.

JSON Schema vyjadruje tvar a statické pravidlá request/VERIFIED. Zhodu task/run/identity medzi poľami a kontrolné súčty musí príjemca navyše overiť cez `MessageSchema` a `verifyReceipt`, alebo ekvivalentnú implementáciu; samotná JSON Schema na to nestačí. Starý v0 výstup ani exitCode=0 sa nikdy automaticky neprevedú na VERIFIED.

Idempotencia vyžaduje opätovné použitie celého pôvodného envelope (vrátane message_id/run_id), nie jeho novú generáciu. Autorizačná kontrola prebieha aj pred replayom. Behy nemajú automatický takeover, slepý retry, produkčné mutácie ani vzdialené cancel. Stav CANCELLED je pripravený v kontrakte, hostiteľský cancel endpoint zatiaľ nie je implementovaný.

Nástrojový diagnostický vstup slúži na necitlivé správy: neposielať tajomstvá ani osobné údaje ako message. Audit log neobsahuje vstupy, výstupy ani text výnimiek; uložený výsledok pre replay zachová diagnostický obal.

Foundation prijíma iba prázdne `constraints` a `acceptance_criteria`; voľné prirodzenojazykové požiadavky ešte nevyhodnocuje a odmietne ich pred vykonaním. VERIFIED znamená splnený konkrétny diagnostický kontrakt, nie automatické potvrdenie ľubovoľného textu v objective.

## Nasledujúce oddelené etapy

1. Nezávislé architektonické review diffu a tejto lokálnej Foundation brány.
2. Overiť skutočné Meta rozhranie, handshake, credential model a scope bez dedenia owner práv. Existujúci Meta Facebook/Instagram OAuth konektor nie je Meta AI agent.
3. Ďalšie host integrácie rozširovať po jednotlivých overených nástrojoch; existujúci MCP diagnostic je už integrovaný. Auru.dev zostáva produkčnou routou; tento release nepresúva domény.
4. Postupne pridať tool-specific acceptance overovače, podpisy, rekonciliáciu UNKNOWN_OUTCOME a potom ďalšie nástroje/PC Bridge. Zachovať admin/owner gate.
5. Rozšíriť existujúci model router, nie vytvoriť náhradu: Azure/Cohere až po overenom nastavení a testoch. Žiadny provider sa týmto PR neoznačuje za živý.

Vlastník následne výslovne schválil publikovanie a nasadenie pripraveného release. Cloudflare self-deploy je teraz iba manuálny workflow_dispatch s explicitným produkčným inputom, aby push nespustil súbežný automatický rollout. TRINITY_AUTO_MERGE=false. GitHub IAM, CI billing a Cloudflare Access politiky sa nemenia; login bol obnovený existujúcou oficiálnou reláciou. Finálny SHA, staging/production Version ID a živé receipts sú súčasťou release reportu.

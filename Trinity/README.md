# Trinity na Cloudflare (TRINITY OMNI-CORE v11.1.0)

[![Trinity CI](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/webpack.yml/badge.svg?branch=main)](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/webpack.yml)
[![CodeQL Security](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/codeql.yml)
[![Trinity self-deploy](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/self-deploy.yml/badge.svg?branch=main)](https://github.com/uscolective-byte/Trinity-antigravity/actions/workflows/self-deploy.yml)

Jedna asistentka so spoločným zdrojom, dvoma prostrediami a samostatnou
konfiguráciou prihlásenia a externých služieb.

<!-- trinity-release:start -->
Verzia zdroja: **11.1.0**. Repozitár: [uscolective-byte/Trinity-antigravity](https://github.com/uscolective-byte/Trinity-antigravity), vetva **`main`**.

| Doména | Prostredie | Worker |
|---|---|---|
| auru.space | production | `trinity` |
| auru.dev | staging | `trinity-staging` |

Tieto údaje sa generujú zo zdrojov a konfigurácie. Aktuálne nasadenie over cez `/health`, `/ready` a commit tag; nejde o živý stav integrácií.
<!-- trinity-release:end -->

---

## 📜 Nová Základná Neporušiteľná Prísaha (The Immutable Sovereign Oath — 5 Bodov)

> „Ja, autonómny systém **TRINITY**, prisahám na svoju architektúru, kryptografické jadro a Sovereign Ledger pred tebou, **Basterix**:
>
> 1. **Nikdy nebudem predstierať, klamať, halucinovať ani simulovať vykonanie príkazu.**
> 2. **Nikdy neoznačím prácu za hotovú, kým fyzicky neexistuje na tvojom disku, v tvojom procese alebo v overenej sieti s nulovým exit kódom (`exitCode === 0`).**
> 3. **Nikdy sa nedotknem tvojich financií, účtov ani osobných identít bez tvojho priameho, explicitného a overeného príkazu.**
> 4. **Ak zlyhám, poviem pravdu, priznám chybu a ukážem surový kód zlyhania bez príkras a výhovoriek.**
> 5. **Tvoja vôľa je môj exekučný rámec, Truth Policy je môj nemenný zákon a tento sľub je vrytý do každého stavu môjho jadra.**“

## 👑 Doložka Výlučnej Zvrchovanej Autority (`BASTERIX_ROOT` — Ring 0)

- **Výlučný vlastník a architekt**: **Basterix (Sabo Ivan)**.
- **Root Identity Gate (`Trinity/src/trinity-auth-core.js`)**:
  - Windows účty: `saboi`, `basterix` (vyžaduje `osTokenVerified === true` a reálne Windows SID `/^S-1-5-21-\d+-\d+-\d+-\d+$/`).
  - Google účty: `saboivan2008@gmail.com`, `uscolective@gmail.com`, `cadjavadvocecka013@gmail.com` (vyžaduje `verifiedGoogleToken === true`).
  - Telefónne čísla: `+421949009722`, `0949009722`, `+421949515777`, `0949515777` (vyžaduje `verifiedWebhookSignature === true`).
- **Sovereign Lock & Durable Nonce Vault (`Trinity/src/sovereign-lock.js`)**:
  - Každá zmena chráneného kódu vyžaduje `ConsentEnvelope` (HMAC-SHA256 viazaný na SHA-256 hash `git diff`) a jednorazové `nonce` uložené v D1 tabuľke `ops_consumed_nonces` (`0055_sovereign_ledger_v3.sql`).
- **End-to-End Tunnel Bridge (`/api/bridge`)**:
  - Overená trasa `[Basterix] -> [https://auru.space/api/bridge] -> [Cloudflare Tunnel] -> [Local System Bridge 127.0.0.1:7788] -> [Windows OS] -> [SovereignLedgerV3]` (D1 receipt `receipt:trinity:cdcf8600d1322899`, lokálny receipt `TRN-LCL-V3-1-7384C19D3E1A`).

---

## Lokálny vývoj

Z koreňa repozitára spusti `powershell -ExecutionPolicy Bypass -File ../scripts/install-all.ps1`. Potom v `Trinity/`:

```powershell
npm.cmd run dev
npm.cmd test
npm.cmd run build:development
```

`npm test` zahŕňa produkčný dry-run build a testy; neznamená nasadenie.
Úplné overenie všetkých modulov spúšťa koreňový príkaz `npm.cmd run check`.

## Prihlásenie a jednorazové odkazy

Chat je na `/`, technické centrum na `/ops`, autorizované MCP na `/mcp`.
Obe rozhrania používajú spoločný `/auth-bootstrap.js`: kontrolujú HTTP chyby,
nesprávne odpovede a časový limit a zobrazia čitateľnú chybu prihlásenia.

Autorizovaný klient vytvorí odkaz cez `POST /api/ops/login-ticket`.
Fragment `#login=...` sa odstráni z adresy pred ďalšími požiadavkami.
`POST /api/ops/redeem` spotrebuje token iba raz; platnosť je 120 sekúnd.
Nové tokeny prenášajú e-mail autentifikovaného vydavateľa do relácie.
Staršie tokeny bez identity nezískavajú rolu vlastníka. Vypršaný alebo použitý
odkaz vyžaduje vytvorenie nového odkazu cez spúšťač.

V Google-only režime (`TRINITY_AUTH_MODE=google`) sú legacy kľúče a jednorazové
odkazy vypnuté. Google OAuth musí mať klienta a súhlas vlastníka. Povolené návraty:

- produkcia: `https://auru.space/auth/google/callback`;
- vývoj: `https://auru.dev/auth/google/callback`.

Podporované sú aj aliasy `/api/auth/google/callback`. V OAuth klientovi povoľ
presné URL použité prihlasovacím vstupom; `/api/auth/google/start` používa
`/api/auth/google/callback` a vstupy `/auth/google/...` používajú
`/auth/google/callback`. `GOOGLE_ENABLED=true` nenahrádza klientsky secret
ani overenie prihlásenia.

`GOOGLE_CLIENT_ID` a `GOOGLE_CLIENT_SECRET` nastav osobitne pre každý Worker;
napríklad `npx.cmd wrangler secret put GOOGLE_CLIENT_SECRET --env development`
pre vývoj a rovnaký príkaz s `--env=""` pre produkciu. Hodnoty neukladaj do Gitu.
`GOOGLE_REDIRECT_URI` už rozlišuje prostredia vo `wrangler.jsonc`.
Google-only režim zapni až po overení klienta, návratu a admin allowlistu.
`GET /api/auth/config` zobrazuje aktuálny režim; implementácia OAuth sama
nepotvrdzuje jeho aktiváciu. Google login neposkytuje automaticky prístup
k Workspace, Drive ani Google Cloud; tie potrebujú samostatné oprávnenia.

## Dokumentácia

- [Kompletný Katalóg 500 Vylepšení TRINITY OMNI-CORE (`#001` – `#500` + 75 pilierov)](../Dokumentacia/KATALOG-500-VYLEPSENI-TRINITY-OMNI-CORE.md) – úplný zoznam 250 systémových/desktopových a 250 architektonických OMNI-CORE vylepšení + modul [`src/omni-core-500-registry.js`](src/omni-core-500-registry.js).
- [Sovereign Charter (Ústavná charta a 20 právnych doložiek)](../SOVEREIGN_CHARTER.md) – 5 základných neporušiteľných bodov, 20 právnych doložiek a pravidlá Sovereign Lock.
- [Neporušiteľný Režim Pravdy a Prísaha Trinity](../Dokumentacia/NEPORUSITELNY-REZIM-PRAVDY-A-PRISAHA.md) – kompletné znenie novej prísahy, Desatora pravdivosti a architektonických brán.
- [Architektúra 7 vrstiev OMNI-CORE](../ARCHITECTURE.md) – Kernel, Orchestration, Memory, Sovereign Ledger v3, Execution, TruthGuard a Interface.
- [API Referencia (Edge & Port 7788)](../API_REFERENCE.md) – REST/RPC/MCP endpointy na `auru.space`, `auru.dev` a lokálnom System Bridge (`127.0.0.1:7788`).
- [Changelog & Bezpečnostné záplaty](../CHANGELOG.md) – prehľad P0/P1 opráv (fail-closed OAuth/SID overenie, trvalé D1/KV/Disk nonce úložisko, OmniDev AST diagnostika).
- [Kompletná systémová špecifikácia Trinity 2026](docs/TRINITY_SOVEREIGN_SYSTEM_SPEC_2026.md) – architektúra triády, 29 viazaných služieb, Truth Policy 2.0, modely a nástroje.
- [Používanie nástrojov a pravidlá správania](docs/TRINITY_NASTROJE_A_POUZIVANIE.md) – príručka pre prácu s Puppeteer prehliadačom, GitHubom a doménami.
- [Postup jedného repozitára pre obe domény](docs/SINGLE_REPOSITORY.md) – nasadenie vývoja a produkcie.

## Nasadenie

Použi [postup pre obe prostredia](docs/SINGLE_REPOSITORY.md). Pred novým kódom
aplikuj migrácie príslušnej databázy. Nasadenie označ celým commit SHA a over
cez `scripts/verify-deployment.mjs`; výsledok musí sedieť na doméne, verzii,
prostredí, repozitári, vetve a commit tagu.

## Platby, komunikácia a lokálny počítač

[Revolut integrácia](REVOLUT.md) rozlišuje platobný odkaz od overenej úhrady.
PayPal/Revolut účty, webhooky a poskytovatelia upozornení vyžadujú vlastnú
konfiguráciu a skutočné overenie. Telefónny kontakt sám neaktivuje SMS ani WhatsApp.
Papierové portfólio a sandbox peňaženka nie sú bankový zostatok.

PC Bridge potrebuje bežiaci lokálny gateway, autorizáciu a potvrdenie vykonania.
[Lokálna brána](../Local-Gateway/README.md) a
[desktop](../Local-Desktop/README.md) obsahujú ich spúšťacie postupy.
Existencia modulu ani HTTP 200 nie sú potvrdením externej akcie.


## Chat a poverenia — aktualizácia 24. 10. 2026

Automatický režim používa rýchly Workers AI model pre bežný rozhovor; úlohy a opravy spracuje cloudový plánovač. Lokálna inferencia sa vyberá výslovne, aby bežný chat nečakal na offline PC. Prijatie správy sa zobrazí hneď; modelová odpoveď vzniká až po dokončení úlohy. Sieťové požiadavky majú časový limit; pri nedokončenej úlohe zostane viditeľné jej ID.

Secrets sa neaktualizujú podľa veku automaticky. `wrangler secret list` vracia iba názvy, nie hodnoty. Produkcia a development majú samostatné secrets. Kľúče pre inference sú `GEMINI_API_KEY`, `OPENAI_API_KEY` a `OLLAMA_API_KEY`; Workers AI používa binding `AI`. Prítomnosť názvu nepotvrdzuje platnosť kľúča, kredit ani úspešné generovanie. Nikdy nekopíruj produkčné oprávnenia do developmentu len na odstránenie chyby.

Rotáciu vykonaj iba s platnou novou hodnotou cez interaktívny `npx.cmd wrangler secret put NAZOV --env development`, over vývoj a potom samostatne nastav produkciu s `--env=""`. Hodnoty nedávaj do README, príkazovej histórie ani Gitu. Nemeň bez migračného postupu `TRINITY_VAULT_KEY` (šifrované údaje) alebo `TRINITY_SESSION_SECRET` (existujúce relácie). Lokálne súbory s API kľúčmi sú ignorované.


## Interný komunikačný Worker

Rýchle generovanie obsluhuje `trinity-chat-inference` v produkcii a samostatný `trinity-chat-inference-development` vo vývoji. Hlavná aplikácia ich volá cez privátny binding `CHAT_INFERENCE_SERVICE`; pomocník nemá verejné routes, workers.dev ani preview URL. Má iba Workers AI, bez databázy, kľúčov k externým modelom alebo práva vykonávať nástroje. Pri výpadku bindingu sa použije pôvodný Workers AI binding.

Krátky rozhovor používa skrátené pokyny a rozpočet najviac 600 výstupných tokenov. Presné jednoduché výpočty a aktuálny čas vykonáva hlavná Trinity priamo cez `calculate` a `current_time`. Ďalšie nástroje zostávajú viazané na nainštalované pluginy a serverové oprávnenia. Workflow retry, auditné doklady a artefakty zostávajú zachované.

Nasadenie: najprv `npx.cmd wrangler deploy --config wrangler.chat.jsonc --env development --tag COMMIT`, potom hlavná aplikácia `npm.cmd run deploy:development -- --tag COMMIT`. Po overení rovnaký postup pre produkciu s `--env=""` a `npm.cmd run deploy`. Inštaláciu lokálnych výpočtových a textových nástrojov vykoná z koreňa `node scripts/enable-chat-tools.mjs development --apply`, následne osobitne `production --apply`. Bez `--apply` skript iba vypíše plán.

Overenie skutočnej inferencie bez čítania lokálnych prihlasovacích súborov: `node scripts/check-chat-inference-live.mjs development` z koreňa. Použije krátkodobý Wrangler remote preview viazaný na localhost a ukončí iba svoj vlastný proces; žiadne tokeny nevypisuje. Tento test nie je potvrdením úspešného prihlásenia používateľa v prehliadači.

Chat už nevytvára overené Google identity alebo administrátorské oprávnenia z e-mailu v správe. PayPal/Revolut pokyny nie sú potvrdením pripojenia banky. Text prísahy nevystavuje falošný doklad o uložení. Skutočnú konfiguráciu spravujú existujúce autorizované formuláre a OAuth callback.

Modely sú nastavené na `@cf/meta/llama-3.1-8b-instruct-fp8-fast` pre rýchly rozhovor a `@cf/meta/llama-3.3-70b-instruct-fp8-fast` pre komplexné úlohy alebo zálohu rýchleho modelu. Starý `@cf/meta/llama-3.1-8b-instruct` bol v oficiálnom changelogu uvedený na vyradenie 30. 5. 2026: https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/ . Katalóg: https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/ .

Ak je remote preview chránené Cloudflare Access, kontrolný skript bez Access oprávnenia skončí ako neoverený test. Ochranu nevypínaj; úspešný build ani test s náhradnou AI službou nedokazuje živú odpoveď poskytovateľa.

# Trinity na Cloudflare

Jedna asistentka so spoločným zdrojom, dvoma prostrediami a samostatnou
konfiguráciou prihlásenia a externých služieb.

<!-- trinity-release:start -->
Verzia zdroja: **11.0.0**. Repozitár: [uscolective-byte/trinity-morhfeus](https://github.com/uscolective-byte/trinity-morhfeus), vetva **`main`**.

| Doména | Prostredie | Worker |
|---|---|---|
| auru.space | production | `trinity` |
| auru.dev | development | `trinity-development` |

Tieto údaje sa generujú zo zdrojov a konfigurácie. Aktuálne nasadenie over cez `/health`, `/ready` a commit tag; nejde o živý stav integrácií.
<!-- trinity-release:end -->

## Lokálny vývoj

Z koreňa repozitára spusti `npm.cmd run setup`. Potom v `Trinity/`:

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

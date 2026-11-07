# Cloudflare Access: overenie prístupu Trinity

Cloudflare Access a prihlasovanie v samotnej Trinity sú dve samostatné vrstvy. API token pre Cloudflare účet umožňuje spravovať infraštruktúru; nie je to prihlásenie cez Access. `TRINITY_MCP_API_KEY` autorizuje aplikačné MCP požiadavky až po prejdení vonkajšej Access ochrany.

## Skutočná konfigurácia zistená 3. novembra 2026

Trinity je chránená natívnou Workers Access aplikáciou `018042bf-984f-4cf6-bf68-cbb760d9a6da`. Jej cieľ je `destinations[].type=worker` a konkrétne `worker_id`. Pole `domain` preto nemusí existovať. Vyhľadávanie aplikácií iba podľa domény nesprávne vyhlási, že ochrana nie je nakonfigurovaná.

Existuje tiež širšia aplikácia „All Workers“. Jej politika sa nesmie meniť iba preto, aby sa pripojil jeden diagnostický klient k Trinity. Pre tento účel nevypínaj Access, nepridávaj Bypass, nepovoľuj Everyone a nepoužívaj ľubovoľný platný servisný token.

Pôvodné pravidlo `Trinity-Agents-Access` už používa `Service Auth` (`non_identity`) a povoľuje konkrétny existujúci token. Pri kontrole však jeho Client ID/Client Secret neboli na PC dostupné pod podporovanými názvami. HTTP302 na `*.cloudflareaccess.com` v takej situácii znamená chýbajúce prihlásenie, nie chybu Durable Object exportu alebo dôkaz zlyhania Workera.

## Bezpečná diagnostika

Z koreňa repozitára, po načítaní existujúcich schválených poverení do aktuálneho procesu:

```powershell
. .\scripts\shared-env.ps1 -Load
node scripts/check-trinity-access.mjs
node scripts/check-trinity-access.mjs --mcp
```

Skript je read-only: nemení aplikácie, politiky, tokeny, Workery ani databázy. Provider kľúče nevolá. Pre každý `/health` a `/ready` odlíši anonymnú požiadavku od autentifikovanej. Redirect sa nenasleduje, aby sa prístupové údaje neposlali na iný host. Z odpovede sa zachovajú iba vybrané prevádzkové metadáta.

Podporované páry premenných sú `CLOUDFLARE_ACCESS_CLIENT_ID` + `CLOUDFLARE_ACCESS_CLIENT_SECRET` alebo `CF_ACCESS_CLIENT_ID` + `CF_ACCESS_CLIENT_SECRET`. Neúplný pár alebo dve rozdielne identity v oboch aliasoch sa odmietnu; ID z jedného páru sa nekombinuje so secretom z druhého. Hodnoty sa nikdy nevypisujú.

`--mcp` navyše používa existujúci `TRINITY_MCP_API_KEY`, oficiálne MCP SDK, `initialize` a `tools/list`. Nevykonáva žiadny nástroj. Úspešné získanie katalógu nie je dôkazom, že všetky nástroje alebo externé integrácie fungujú.

Voliteľné `--output FILE` vytvorí nový bezpečne filtrovaný JSON report; existujúci súbor sa neprepisuje. Výstup neobsahuje cookies, klientsky secret, API token ani surové provider chyby. Návratový kód 0 znamená úspešné autentifikované health/ready overenie (a MCP, ak bolo vyžiadané). Kód 2 znamená nedokončené overenie; kód 1 chybu samotného diagnostického behu.

## Výber správneho riešenia

1. Ak vlastník má platný existujúci servisný pár, použije sa cez schválený lokálny mechanizmus. Secret sa neposiela do chatu.
2. Ak je dostupné iba prihlásenie v prehliadači, overuje sa web cez túto reláciu. Browser cookies sa nekopírujú do konfigurácie iných aplikácií.
3. Ak treba nové poverenie, pred vytvorením získaj konkrétny súhlas vlastníka s cieľovou aplikáciou, dobou platnosti a miestom uloženia. Neotáčaj spoločný existujúci token, ktorý môžu používať iné služby. Preferuj krátku platnosť a nové konkrétne pravidlo iba pre Trinity.

Nový token ani politika nevzniknú spustením diagnostiky. Povolenie na commit/push/deploy samo osebe nie je potvrdenie širšieho prístupu alebo nového cloudového účtu.

## Staging a release

Pre `auru.dev` možno spustiť `--origin https://auru.dev`. Ak staging nemá samostatnú aplikáciu, diagnostika nepredstiera, že produkčné app ID dokazuje jeho politiku; príslušné overené ID môže operátor nastaviť cez `TRINITY_ACCESS_APP_ID`.

Úspešný Access probe nevynucuje zhodu release SHA ani nemigruje dáta. Pred produkčným deployom stále platia testy, hosted CI, izolácia a overený staging postup. Existujúci `verify-deployment.mjs` slúži na overenie verzie a zdroja, nie na získanie Access oprávnenia.

Oficiálne zdroje: [Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) a [autentifikácia coding agentov](https://developers.cloudflare.com/cloudflare-one/access-controls/authenticate-agents/).

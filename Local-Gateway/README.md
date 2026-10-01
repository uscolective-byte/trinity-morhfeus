# Trinity Local Gateway

Privátna systémová vrstva jednej Trinity. Počúva výhradne na `127.0.0.1:8791` a pracuje iba v koreňovom priečinku Morhfeus.

## Bezpečnostný model

- tajný lokálny token je uložený cez Windows DPAPI a nie je vo verziovacom systéme,
- `.credentials`, `.git`, `.wrangler`, `node_modules`, `.env` a súkromné kľúče sú nedostupné,
- nie je povolený ľubovoľný shell; spúšťajú sa iba pevne povolené úlohy,
- každá zmena má postup `návrh -> presné schválenie ID -> vykonanie -> potvrdenie`,
- `selfwrite` môže meniť iba súbory projektu `Trinity` a vyžaduje aktuálny SHA-256,
- upload/share bez pripojeného cieľa iba pripravia lokálny outbox a nikdy nepredstierajú zverejnenie.

## Spustenie

1. Raz spusti `setup.ps1`.
2. Raz spusti `connect-cloud.ps1`; vytvorí oddelený kľúč, uloží ho cez Windows DPAPI a bezpečne ho nastaví ako Cloudflare secret.
3. Potom používaj `SPUSTIT-LOCAL.cmd`.
4. `install-autostart.ps1` nastaví bezpečné automatické spustenie po prihlásení do Windows.

## Ovládanie počítača

Desktop Controller 1.1 podporuje zoznam otvorených okien, spustenie a aktivovanie povolených aplikácií a písanie do Poznámkového bloku. Pred každou desktopovou operáciou musí používateľ schváliť presné ID návrhu. Predvolený zoznam aplikácií: Poznámkový blok, Kalkulačka, Skicár a Prieskumník. Prehliadače, heslá, platby a neobmedzené príkazy nie sú povolené.

## Lokálny mozog

Lokálny Ollama model `qwen3:4b-instruct` môže spracovať chat na tomto počítači bez spotreby cloudového modelu. Instruct varianta nepoužíva dlhý thinking výstup, ktorý na tomto CPU spôsoboval timeout. Profil používa 6 z 8 logických procesorov, 4K kontext a necháva dva procesory pre Windows. Tento počítač má 15,6 GB RAM, štvorjadrový i5-10310U a integrovanú Intel UHD; je vhodný pre 4B až menší 8B kvantovaný model, nie pre veľký 31B model. Presný profil je v `config/resource-profile.json`.

Cloudflare Worker `trinity-pc-bridge` prijíma pravidelný heartbeat a cez interné RPC zobrazuje orchestrátoru stav PC. Jeho kľúč je uložený cez Windows DPAPI a na Cloudflare ako Worker secret.

Stav bez tajného kľúča: `GET http://127.0.0.1:8791/health`.

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

Stav bez tajného kľúča: `GET http://127.0.0.1:8791/health`.

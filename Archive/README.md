# Archív Trinity

`cloudflare-exports/` obsahuje šesť pôvodných surových multipart exportov Cloudflare.
Tieto súbory nie sú spustiteľný JavaScript a nie sú vstupom aktívneho buildu.
Obsah je zachovaný bez zmeny; prípona `.multipart.txt` zabraňuje zámene s modulmi.

Aktívny Worker: `Trinity/src/index.js`, konfigurácia `Trinity/wrangler.jsonc`.
Koreňové `src/` sú kompatibilné odkazy na kanonický zdroj. Nie sú to staré kópie.
`Trinity/src/v4/` obsahuje používané moduly; názov verzie nie je dôvod na vymazanie.

`0033_copilot_audit.sql.txt` je zachovaná duplicitná kópia koreňovej migrácie.
Kanonická spustiteľná migrácia zostáva v `Trinity/migrations/0033_copilot_audit.sql`.
Všetky konfigurácie Wrangler používajú kanonický adresár; koreňová kópia nemala odkazy.

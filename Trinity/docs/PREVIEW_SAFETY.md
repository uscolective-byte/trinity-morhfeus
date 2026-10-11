# Bezpečný náhľad zostavenia

V `wrangler.jsonc` je explicitný blok `previews`. Wrangler preto nemusí automaticky odvodzovať náhľad z produkcie ani prevádzať konfliktné AI väzby.

Tento prvý náhľad je zámerne **build-only**, nie integračné alebo vývojové prostredie s prístupom k dátam:

- `GET /health` a `GET /api/health` overujú, že balík beží.
- `GET /ready` vracia HTTP 503 a `ready: false`: integrácie nie sú overené.
- Všetky ostatné HTTP cesty, vrátane UI, prihlásenia a MCP, vracajú HTTP 503.
- Plánované úlohy sa nevykonávajú a prijímané e-maily sa odmietajú.
- Náhľad nedeklaruje žiadne D1, R2, KV, AI, PC ani službové väzby. Nemení produkčné nastavenia ani dáta.
- Zdieľané tajomstvá z Cloudflare Preview Base môžu byť platformou zdedené; kód build-only náhľadu ich nečíta ani nevystavuje. Táto zmena ich nemaže ani nerotuje.

Produkcia nemá `TRINITY_PREVIEW_MODE=build-only` a pokračuje pôvodnými cestami.

## Overenie

1. V Cloudflare Workers Builds použiť koreň `Trinity`, build príkaz `npm test` a náhľadový deploy príkaz `npx wrangler preview --config wrangler.jsonc`.
2. Po vytvorení Preview overiť JSON z `/health`, HTTP 503 a `ready: false` z `/ready` a HTTP 503 z `/mcp`.
3. Úspešné vytvorenie tohto náhľadu nepotvrdzuje prihlasovanie, AI odpoveď, vykonanie úlohy ani prístup k PC. Samo osebe nie je dôvodom nasadiť zmenu do produkcie.

## Ďalšia fáza: integračné staging prostredie

Pred odstránením build-only ochrany vytvoriť samostatné testovacie D1/R2/KV zdroje, testovacie prihlasovanie a oddelený Workflow. Náhľad nesmie volať produkčný PC Bridge, produkčné Workflow ani službové väzby. Migrácie aplikovať iba na staging D1 a overiť autentifikáciu aj negatívne oprávnenia. Produkčné kľúče a pamäť nekopírovať.

Referenčná dokumentácia:

- [Cloudflare Preview configuration](https://developers.cloudflare.com/workers/previews/configuration/)
- [Cloudflare Preview resources and isolation](https://developers.cloudflare.com/workers/previews/resources/)
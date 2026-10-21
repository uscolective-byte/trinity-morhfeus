# Cloudflare Workers Builds — príkazy Trinity

Root directory: `Trinity`

Build command (požiadavka vlastníka: build bez testov):
```sh
npm run build
```
Cloudflare vykonáva inštaláciu závislostí pred build príkazom. Skript v Trinity/package.json zostaví MCP App a Worker cez Wrangler dry-run; nenasadzuje produkciu.

Produkčný deploy command:
```sh
npm run deploy
```
Preview command:
```sh
npx wrangler preview --config wrangler.jsonc
```
Tieto polia v Cloudflare Settings > Builds sa spravujú samostatne. Tento dokument ich vzdialene neprepíše. Build sa nesmie zamieňať za úspešné nasadenie.

Samostatné testy zostávajú v GitHub CI. Test preview konfigurácie bol aktualizovaný na explicitné izolované Durable Object bindingy bez namespace_id/script_name; nesúlad s pôvodným prázdnym preview blokom už nie je očakávaný. V prípravnom prostredí prešlo 30 izolovaných konfiguračných assertions a 2 negatívne prípady odmietli únik namespace a zdieľanú produkčnú D1; nejde o spustenú celú Node suite. Cloudflare log pre starší commit c25c64e zaznamenal 317 úspešných testov.

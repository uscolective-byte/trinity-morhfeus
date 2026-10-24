# Jeden zdroj pre obe domény

Jediným zdrojovým repozitárom pre obe nasadenia je
`uscolective-byte/trinity-morhfeus`, vetva `main`, aplikácia `Trinity/`.

| Doména | Prostredie | Worker | Zdroj |
|---|---|---|---|
| `auru.space` | produkcia | `trinity` | `main` |
| `auru.dev` | vývoj a testovanie | `trinity-development` | `main` |

Samostatný vývojový repozitár ani vetva nie sú potrebné. Prostredia určuje
`Trinity/wrangler.jsonc`. D1, KV, R2 a operations workflow majú oddelené
prostriedky; prihlásenia, dáta ani platby sa týmto postupom nekopírujú.
Niektoré pomocné Workers služby zostávajú spoločné podľa konfigurácie.

## Nasadzovanie

Workflow `Trinity self-deploy` odmietne spustenie mimo hlavného repozitára
a vetvy `main`. Po testoch nasadí vývoj a overí doménu `auru.dev` proti
presnému commitu. Produkcia sa následne nasadí pri ručnom spustení s
`deploy_production=true`, alebo pri pushi, ak je existujúca repository variable
`TRINITY_AUTO_DEPLOY_PRODUCTION=true`. Pravidlá GitHub environment `production`
sa naďalej uplatňujú. GitHub potrebuje secret `CF_API_TOKEN`.

Pri priamom nasadení zo synchronizovaného a čistého `main`:

```powershell
cd Trinity
$releaseCommit = git rev-parse HEAD
npm.cmd ci
npm.cmd test
npm.cmd run build:development
npm.cmd run migrate:development
npm.cmd run deploy:development -- --tag $releaseCommit
node scripts/verify-deployment.mjs https://auru.dev $releaseCommit
# Až po úspešnom overení vývoja:
npx.cmd wrangler d1 migrations apply trinity-v03 --remote --env=""
npm.cmd run deploy -- --tag $releaseCommit
node scripts/verify-deployment.mjs https://auru.space $releaseCommit
```

`/health` a `/ready` uvádzajú `source.repository` a `source.branch`.
Samotné tieto polia sú deklarovaná konfigurácia. Dôkaz vydania tvorí aj
zhoda `deployment.tag` s overeným commitom, verzia, prostredie a úspešný
`/ready`; skript `verify-deployment.mjs` kontroluje tieto údaje spoločne.

Staršie repozitáre sa týmto postupom nemažú. Pred ich prípadným archivovaním
treba skontrolovať unikátny kód a externé nasadzovacie prepojenia. Tento
dokument nepotvrdzuje odpojenie prípadných starých CI alebo Workers Builds.

OAuth, bankové účty, SMS a webhooky sa autorizujú samostatne pre požadované
prostredie. Zjednotenie repozitára ich samo neaktivuje.

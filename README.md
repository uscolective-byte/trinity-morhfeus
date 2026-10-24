# Trinity / Morhfeus

Osobná asistentka, webové rozhranie a Cloudflare backend v jednom repozitári.
Hlavná aplikácia a konfigurácia sú v `Trinity/`. Koreňové `src/` a `tests/`
obsahujú kompatibilné vstupy; zdrojové zmeny smerujú do kanonických modulov.

<!-- trinity-release:start -->
Verzia zdroja: **11.0.0**. Repozitár: [uscolective-byte/trinity-morhfeus](https://github.com/uscolective-byte/trinity-morhfeus), vetva **`main`**.

| Doména | Prostredie | Worker |
|---|---|---|
| auru.space | production | `trinity` |
| auru.dev | development | `trinity-development` |

Tieto údaje sa generujú zo zdrojov a konfigurácie. Aktuálne nasadenie over cez `/health`, `/ready` a commit tag; nejde o živý stav integrácií.
<!-- trinity-release:end -->

## Spustenie a overenie

Použi Node.js 22 alebo novší a npm. Na Windows používaj `npm.cmd`, ak
PowerShell blokuje `npm.ps1`.

```powershell
npm.cmd run setup
npm.cmd run docs:check
npm.cmd run build
npm.cmd run check
```

`setup` inštaluje závislosti cloudových modulov a lokálnej brány. `build`
vykonáva dry-run zostavenia; nič nenasadzuje. `check` spúšťa testy modulov,
integračný runtime a kontrolu závislostí. Skutočný výsledok určuje návratový kód.

Na synchronizáciu čistého `main` s `origin/main` a následné overenie:

```powershell
npm.cmd run sync
```

Synchronizácia odmietne nesprávny repozitár, vetvu aj rozpracované súbory.
Starší Windows vstup `SYNC-BUILD.ps1` zostáva podporovaný; `-SkipSync` umožňuje
lokálne overenie rozpracovaného stromu a `-Deploy` vyžaduje čistý kanonický zdroj.
NPM chyby z tohto vstupu sa ukladajú do ignorovaného priečinka `logs/`.

Verzia, domény a vetva v oboch README sa generujú z aplikácie a Wrangler
konfigurácie. Po zmene vydania spusti `npm.cmd run docs:sync`; CI kontroluje
`npm.cmd run docs:check`.

## Moduly

- `Trinity/`: chat, AI Studio, domény, pamäť, platobné odkazy, API a MCP.
- `Knowledge-Worker/`, `Integrations-Worker/`, `Capacity-Worker/`: znalosti, konektory a kapacity.
- `PC-Bridge-Worker/`, `Local-Gateway/`, `Local-Desktop/`: cloudový most a lokálne nástroje.
- `Audit-Worker/`: auditné záznamy.

Lokálnu bránu spusti cez `npm.cmd run gateway`; desktop cez
`npm.cmd run desktop`. Spúšťacie súbory a oprávnenia opisujú README týchto modulov.

## Nasadenie a integrácie

[Postup jedného repozitára pre obe domény](Trinity/docs/SINGLE_REPOSITORY.md)
opisuje nasadenie vývoja, overenie commitu a následnú produkciu. Primárne
D1/KV/R2 úložiská sú oddelené; niektoré pomocné Workers služby sú spoločné.
Staršie repozitáre sa synchronizáciou nemažú.

[Konfigurácia aplikácie a prihlasovania](Trinity/README.md) odlišuje hotový kód
od aktivovaných účtov. E-mail, RevTag ani telefónne číslo nenahrádzajú
OAuth súhlas, platobný checkout alebo pripojenú SMS bránu.

`/health` potvrdzuje dostupnosť a verziu; `/ready` pripravenosť väzieb a schémy.
Samy nepotvrdzujú vykonanie platby, registráciu domény ani dostupnosť každého modelu.
Tajomstvá patria do Worker secrets alebo ignorovaných lokálnych súborov.

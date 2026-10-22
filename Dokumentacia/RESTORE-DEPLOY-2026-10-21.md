# Obnova a nasadenie Trinity
Obnovené sú zmeny PR #44 z commitu 0166fc1c96f58340f7ef61cd6754de13598c6cb6 nad main 6af4389653d55445c7fc9aac12d4d777392ade57. Denný plánovač z PR #45 zostáva zachovaný vrátane oboch limitov create_daily_plan. Úpravy index.js boli zlúčené podľa jednoznačných pôvodných úsekov; ostatné súbory PR #44 neboli novým main zmenené.

GitHub self-deploy run 39572905350, attempt 2: verify failure, žiadny runner a nula krokov; deploy development/production skipped. Anotácie nie sú dostupné cez súčasné pripojenie, preto príčina (napr. účet, kvóta alebo pravidlá Actions) nie je potvrdená. Zmena kódu ani opakovanie tohto workflow sama neopravuje pridelenie runnera.

Samostatná kontrola Workers Builds: trinity pre main 6af4389 hlási success, Build ID 88907b1d-d176-4d6b-a02e-91bfb2e1cd16 a Version ID 863ecc84-3985-4aea-9114-fdc18b723555. Tento doklad nepotvrdzuje GitHub testy, živé HTTP overenie ani nasadenie obnoveného PR.

## Miestny fallback
Trinity/scripts/deploy-core-windows.ps1 používa existujúce OAuth prihlásenie Wranglera. Vyžaduje Node, npm.cmd, npx.cmd, Git a čistý checkout presného commitu. Nepoužíva zastarané lokálne kópie; -Commit musí zodpovedať git HEAD. Pri chýbajúcom Gite sa zastaví.

Spustenie z koreňa správneho checkoutu:
```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\Trinity\scripts\deploy-core-windows.ps1 -Commit (git rev-parse HEAD)
```
Prepínač -DeployProduction pridá produkčné migrácie a nasadenie až po úspešných testoch a overení vývoja. Bypass platí iba pre tento proces; nemení trvalú politiku PowerShellu.
Skript skončí pri prvom neúspešnom príkaze. Používa existujúci verify-deployment.mjs, ktorý overuje JSON a presnú verziu/tag, nie iba HTTP 200. Hlásenie domény HTML namiesto JSON je blokér a nesmie sa obísť.

Tento fallback nasadzuje jadro a jeho Workflows/DO z wrangler.jsonc. Nenasadzuje naslepo všetky historické Workers alebo lokálne Windows služby. Tie potrebujú vlastný inventár a test kompatibility. Pred produkčnými migráciami zachovaj zálohu D1 podľa existujúceho prevádzkového postupu; návrat kódu nevracia dátové zmeny.

Overenie pri obnove: syntax zlúčeného index.js a zachovanie dvoch limitov plánovača; obnovené bloby sú totožné s pôvodným PR. Kompletné Node testy ani PowerShell fallback neboli spustené, pretože pracovné prostredie je odpojené. Produkcia obnovených zmien nie je potvrdená.

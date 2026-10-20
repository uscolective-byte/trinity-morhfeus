# Trinity Hybrid Desktop 2.0

Jedna Trinity pre lokálny počítač a Cloudflare. Lokálny panel používa existujúci cloudový MCP, ten istý register úloh a spoločnú pamäť. Zdroj je teraz súčasťou repozitára, nie iba externý ZIP.

## Použitie vo Windows

Rozbaľ celý release do priečinka. `1-SPUSTIT-TRINITY.cmd` otvorí panel bez Gitu, npm alebo systémovej inštalácie Node. Release obsahuje overený Node Windows x64 v22.23.3. Samotný Git checkout binárku neobsahuje.

- `2-NASTAVIT-AI.cmd`: inštalácia Ollama a modelu qwen3:4b; prvé stiahnutie potrebuje internet.
- Prepojenia: nastavenie Gemini API kľúča, Copilot Studio Direct Line secretu, cloudového MCP kľúča a samostatného Gateway kľúča. Hodnoty sa chránia Windows DPAPI, neposielajú sa späť do UI.
- `3-PREPOJIT-KLIENTOV.cmd`: projektové MCP konfigurácie pre Gemini CLI a GitHub Copilot. Klient musí byť samostatne nainštalovaný/prihlásený; spustená Trinity poskytuje tie isté Workspace súbory a poznámky. Zápis sa zapína v Prepojeniach.

Gemini API a Gemini CLI sú dve samostatné cesty. Microsoft Copilot Studio používa priamy chat bez lokálnych nástrojov; GitHub Copilot používa MCP. Bežný Windows Copilot nie je vyhlásený za pripojený.

## Cloud a lokálne dáta

Cloudový MCP kľúč potrebuje mcp:read + mcp:write. Produkcia a vývoj majú oddelené credentialy a pevné ciele auru.space / auru.dev.

- Úlohy: trvalý lokálny outbox, idempotency key uložený pred odoslaním, opakovanie po výpadku s tým istým kľúčom, poll skutočného cloudového výsledku. `queued` sa nepovažuje za úspech.
- Pamäť: `sync_shared_notes` cez MCP synchronizuje poznámky oboma smermi. Optimistická revízia zabraňuje tichému prepísaniu. Konflikt sa zobrazuje s možnosťou vybrať lokálnu alebo cloudovú verziu. Mazanie používa tombstone; aktívne poznámky sa v rovnakej D1 transakcii premietnu do existujúcej ops_memory a sú dostupné cloudovému recall.
- Automatická synchronizácia každú minútu je voliteľná. Zmena prostredia zneplatní lokálne revízne mapovanie; obsah sa nikdy automaticky neprepíše cez konflikt.
- PC most: zapína sa explicitne s existujúcim Gateway kľúčom. Používa pôvodný claim/receipt protokol a ProposalStore vrátane obnovy po reštarte a opätovného odoslania dokladu. Nezapínaj súčasne druhý konzument nad tou istou frontou, ak používaš plnú Local Gateway.
- Desktop executor poskytuje read/write/edit v samostatnom Workspace, system_info a lokálnu inferenciu. Shell, Git, deploy a ostatné desktopové akcie patria plnej Local Gateway; Desktop nepredstiera ich vykonanie.

Lokálny chat môže používať Ollama, Gemini API alebo zaraďovať cloudové úlohy. Pri Gemini sa odosielajú správy a výsledky použitých nástrojov Googlu. Synchronizácia odosiela vybrané spoločné poznámky cloudu. Copilot Studio dostáva aktuálnu správu, nie celú lokálnu pamäť.

## Aktualizácia z verzie 1

Najprv ukonči starú Trinity jej tlačidlom. Zálohuj Data a Workspace. Rozbaľ v2 do rovnakého priečinka Trinity-Local. Release neobsahuje Data ani Workspace, takže ich súbory nenahrádza. Existujúce notes.json/settings.json sa načítajú bez migrácie. Nespúšťaj starý a nový server naraz.

## Potrebná cloudová aktualizácia

Shared-memory protokol vyžaduje nasadenie cloudového kódu tejto zmeny a D1 migráciu `0041_shared_local_notes.sql`. Desktop pri staršom cloude ohlási chybu; netvrdí synchronizovaný stav. Žiadne cloudové poverenia sa nevytvárajú automaticky.

Vývoj: v Trinity spusti existujúci development migration/deploy workflow, potom over MCP status a vzorovú poznámku. Produkčný release až po vývojovom overení. Bez deploy credentialov nemožno tento krok vyhlásiť za dokončený.

## Testy a balenie

`node --test Local-Desktop/tests/*.test.mjs` z koreňa repozitára; Trinity test suite overuje aj skutočný D1 CAS a recall.

`python Local-Desktop/scripts/build-windows.py --runtime-dir <overeny-runtime> --output <release.zip>` vytvorí rovnaký balík. Runtime SHA je pevne overený; obsahuje oficiálnu licenciu. Balenie iba upraví relatívny import spoločnej Gateway knižnice na jej pribalenú kópiu. Po rozbalení možno spustiť tie isté lokálne testy.

Rollback: vrátiť zdrojový commit; tabuľku ops_shared_notes nemaž. Pri návrate na v1 sa spoločná pamäť nesynchronizuje; nové Data ponechaj zálohované. DPAPI credentialy sú viazané na konkrétny Windows účet.

## Hranice overenia

Provider HTTP protokoly, fronta, MCP a cloudová D1 synchronizácia sú testované s lokálnymi simulovanými poskytovateľmi. Windows DPAPI, spúšťače, prihlásenie klientov, reálne Gemini/Copilot účty a živý Cloudflare deploy potrebujú overenie na pripojenom PC/účte. Konfigurácia nie je dôkaz úspešného spojenia.

# Trinity — jeden projekt, jedno miesto na pokračovanie

Kanonický repozitár: **uscolective-byte/Trinity-antigravity**. Výsledná pracovná vetva: **codex/consolidated-20261103**. `main` zostáva základnou vetvou; tento balík do nej zatiaľ nie je zlúčený.

## Obnova a pokračovanie

```powershell
git clone --branch codex/consolidated-20261103 https://github.com/uscolective-byte/Trinity-antigravity.git
cd Trinity-antigravity
```

Používaj tento jeden checkout. Najprv čítaj AGENTS.md a aktuálny koniec TEAM-HANDOFF.md. Prehľad dokončených zmien a obmedzení je v [PROJECT-STATUS.md](PROJECT-STATUS.md).

## Čo sa stalo so starými vetvami

Majiteľ 3. novembra 2026 schválil ponechať na GitHube iba main a konsolidovanú vetvu. Pred odstránením názvov vetiev sú ich pôvodné commity zachované v histórii konsolidovanej vetvy. Starší kód sa nekopíruje cez novší main: TAP a bridge už boli začlenené, chýbajúce opravy sú prenesené a testované osobitne.

[Inventár](docs/consolidation/branch-inventory.json) obsahuje pôvodné SHA a názvy. [Prvý záložný manifest](docs/recovery/github-backup-20261103.json) je historický záznam overenia pred uprataním, nie zoznam stále existujúcich vetiev. Starý súbor sa dá získať napríklad `git show SHA:cesta/k/suboru`.

Necommitnutý secret-vault zo snapshotu worktree-2 je dokončený v aktuálnom resolveri. Snapshot worktree-8 je starý generovaný Tetrakis artefakt; používa sa aktuálny zdroj a overený build. Staré denníky sú históriou, aktuálny stav určuje tento prehľad a posledný handoff.

## Inštalácia a build

Závislosti inštaluj podľa README jednotlivých balíkov a ich lockfiles. `node scripts/run-all-tests.mjs` spúšťa projektovú bránu; `npm --prefix Trinity run build` je lokálny Cloudflare dry-run. Žiadny z týchto výsledkov sám nepotvrdzuje živé provider účty alebo nasadenie.

## Pred vymazaním počítača

GitHub neobsahuje osobné súbory, ignorované databázy, .entials, lokálne nastavenia aplikácií ani všetky projektové výstupy mimo repozitára. Tie potrebujú samostatnú šifrovanú zálohu mimo počítača. DPAPI kópia nemusí po reinštalácii fungovať bez pôvodnej Windows identity; poverenia musia mať bezpečný obnoviteľný zdroj.

Schválené upratanie vetiev nie je vymazaním disku. Úplná záloha osobných a ignorovaných dát sa v tejto úlohe neoverila.

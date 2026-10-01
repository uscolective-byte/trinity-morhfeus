# Pokračovanie bez straty kontextu

Tento súbor je prvý kontrolný bod pre nový chat alebo model. Pred pokračovaním treba prečítať:

1. `Dokumentacia/AKTUALNY-STAV.md`
2. `Dokumentacia/HISTORIA-ZMIEN.md`
3. `stav-projektu.json`
4. `Trinity/README.md`

## Pravidlá pokračovania

- Zdrojom pravdy je `C:\Users\saboi\Documents\Codex\Morhfeus\Trinity`.
- Produkčné tvrdenie musí mať test, Cloudflare Version ID alebo živý výsledok.
- Tajomstvá sa nečítajú ani nevypisujú; používajú sa iba cez chránené vstupy.
- Najprv sa dokončí a overí aktuálny krok, až potom sa začne ďalší.
- Jedna Trinity používa modely, špecializácie a moduly ako nástroje; nevytvárajú sa oddelené identity.
- Ak Codex limit skončí, práca sa zastaví na bezpečnom kontrolnom bode. Po obnovení sa pokračuje podľa `next_action` v `stav-projektu.json`.

## Aktuálny ďalší krok

Vybudovať izolovaný Cloudflare Sandbox s Python, Node.js a Java, pridať meranie spotreby a postupné spomaľovanie pri 70 %, 85 % a 95 % interného mesačného rozpočtu. Sandbox nesmie mať internet ani prístup k tajomstvám Trinity.

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

## Aktuálny stav

Trinity 6.7.0 je nasadená s AI Studio builderom, Nastaveniami, privátnou lokálnou bránou 1.2.0, Workerom `trinity-pc-bridge` a Firebase stavovým mostom. Produkčný checkpoint Trinity je `1b3f0e9a-5034-4246-b501-dd35cb0f861e`, PC Bridge checkpoint je `c62c93b6-5e69-4704-b3ac-98be6dddf516`; Worker testy prešli 37/37, gateway 8/8 a PC Bridge 2/2. Živý lokálny AI a desktopový test prešiel.

## Aktuálny ďalší krok

Pridať kapacitný manažér s postupným spomaľovaním pri 70 %, 85 % a 95 % rozpočtu a potom izolovaný Python, Node.js a Java sandbox. Sandbox nesmie mať internet ani prístup k tajomstvám Trinity. Platobné a sociálne konektory pripájať iba po samostatnom OAuth schválení používateľa.

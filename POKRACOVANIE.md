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

Trinity 6.5.0 je nasadená s reálnym AI Studio builderom, Nastaveniami, privátnou lokálnou bránou a Firebase stavovým mostom. Produkčný checkpoint je Cloudflare Version ID `e1999413-7972-46fd-ab30-4dce85a3a9d2`; Worker testy prešli 37/37.

## Aktuálny ďalší krok

Pridať kapacitný manažér s postupným spomaľovaním pri 70 %, 85 % a 95 % rozpočtu a potom izolovaný Python, Node.js a Java sandbox. Sandbox nesmie mať internet ani prístup k tajomstvám Trinity. Platobné a sociálne konektory pripájať iba po samostatnom OAuth schválení používateľa.

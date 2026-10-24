# Ďalší krok Trinity: jedna záložka Dokumentácia

Zadané Basterixom 24. 10. 2026. Stav: naplánované, ešte neimplementované.

## Zadanie

V existujúcom rozhraní vytvoriť jednu viditeľnú záložku **Dokumentácia** s vnútornými sekciami. Používateľ má na jednom mieste nájsť, čo Trinity dokáže, kde sa čo nastavuje a ako sa používa.

## Poradie realizácie

1. **Začíname / návod pre nájomcov**
   - Prihlásenie, prvá úloha, nový rozhovor, história, prílohy a sťahovanie výsledkov.
   - Návody pre chat, AI Studio, domény a hosting, platby a peňaženku, pamäť a nastavenia.
   - Pri každom návode uviesť konkrétne kroky, potrebné oprávnenia, očakávaný výsledok a riešenie chýb.
   - Vysvetliť rozdiel medzi vlastníkom, správcom a nájomcom podľa skutočne implementovaných rolí.
   - Oddelenie dát, prístupov a kľúčov jednotlivých nájomcov overiť v kóde; neuvádzať neexistujúce záruky.
2. **Podrobná architektúra**
   - Domény auru.space / auru.dev, prostredia, vstupné body a nasadenie.
   - Worker jadro, agenti, model router, nástroje a integrácie, PC Bridge.
   - Pamäť a dáta: Durable Objects, D1, Vectorize a R2 podľa skutočných bindings.
   - Tok správy od rozhrania po model/nástroj, uloženie výsledku a audit.
   - Konfigurácia, názvy potrebných secrets bez ich hodnôt, bezpečnosť, prevádzka a riešenie porúch.
   - Pridať diagram architektúry a odkazy na relevantný kód.
3. **Dohody, sľuby a stav plnenia**
   - Samostatná sekcia v tej istej záložke, vrátane možnosti vytvoriť trvalý záznam dohody.
   - Zaznamenať len dohody doložené rozhovorom alebo existujúcim dokumentom.
   - Každá položka: znenie, zdroj/dátum, rozsah, stav, dôkaz overenia a zostávajúci krok.
   - Rozlíšiť dohodnuté, rozpracované, overené a nesplnené.
   - Sľub ani text asistenta nepovažovať za dôkaz vykonanej akcie.
4. **Čo kde robiť / katalóg schopností**
   - Prehľad funkcií s odkazom na príslušnú obrazovku a príkladmi zadaní.
   - Označiť dostupné, vyžadujúce konfiguráciu a plánované schopnosti.
   - FAQ, chyby prihlásenia, nedostupný model, neúspešné nasadenie a kontakt na správcu.

## Kritériá dokončenia

- Záložka je dostupná z hlavného menu; všetky sekcie fungujú na počítači aj mobile.
- Dlhé návody sa dajú prečítať až do konca bez prekrytia vstupným panelom.
- Vyhľadávanie nájde funkciu, jej návod a súvisiace nastavenia.
- Nájomca vidí iba dokumentáciu určenú jeho role; administrátorské údaje sú chránené.
- Architektúra a tvrdenia o schopnostiach sú overené proti aktuálnemu kódu.
- Dohody majú dohľadateľný zdroj; splnenie má konkrétny dôkaz.
- Overiť navigáciu, odkazy, vyhľadávanie, oprávnenia a čitateľnosť pred nasadením.

## Samostatná následná úprava z fotografie

Vylepšiť ikony a rozloženie bočného menu podľa označenia na fotografii bez zmeny funkcie navigácie.

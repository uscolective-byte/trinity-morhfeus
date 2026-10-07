# Rozšírenie Trinity: osobnosť, kapacita a domáci server

## Overené v pracovnej kópii 6. októbra 2026

Zdroj: `uscolective-byte/trinity-morhfeus`, vetva `master`.
Používateľ uviedol aktuálny Windows priečinok
`C:\users\isabo\codex\documents\morfheus`. Táto cesta v tomto prostredí
nie je prístupná. Staršie checkpointy uvádzajú iný priečinok.

- Trinity 8.0.0: Wrangler dry-run a 52/52 testov prešli.
- Local Gateway: 8/8 testov prešlo.
- PC Bridge: 2/2 testov pravidiel prešlo; nové živé spojenie s PC nebolo overené.
- Nový Capacity Worker: Wrangler dry-run a 10/10 testov prešli, vrátane
  súbežných RPC rezervácií, idempotencie a odmietnutia prekročenia rozpočtu.
- Po pridaní profilu osobnosti prešlo znovu 17/17 runtime testov Trinity,
  ktoré aplikujú aj novú migráciu do lokálnej testovacej D1.
- GitHub workflow iba buildí/testuje; neobsahuje deploy krok.
- Posledný GitHub CI beh bol neúspešný bez spustených krokov. To samo osebe
  nedokazuje chybu kódu. Cloudflare Git build konfigurácia nebola dostupná.
- Verejné health hlási serving a počet špecializácií; nevolá model ani netestuje
  všetky závislosti. Registry rolí nie je dôkazom 40 samostatných Workerov.

## Zistenia z architektúry

`Trinity/src/index.js` prijíma chat a zakladá job. `workflow.js` obnovuje
kontext, volá špecializácie a archivuje výstup. `engine.js` volá model a
allowlist nástrojov. `tools.js` obsahuje webové vyhľadávanie cez Ollama API,
výpočty, obrázky a návrhy systémových akcií. Vyhľadávanie potrebuje platný
Ollama API kľúč; existujúci kód ešte nepotvrdzuje funkčnosť živého účtu.

`Local-Gateway` polluje schválené akcie cez odchádzajúce HTTPS a posiela
heartbeat. `PC-Bridge-Worker` uchováva stav spojenia a potvrdenia. Router
pre tento tok nepotrebuje príchozí port. `Firebase` je stavový most,
nie druhý mozog Trinity.

Aktuálna pamäť je obmedzené SQL vyhľadávanie a kontext; v tomto kóde nie je
kompletná sémantická znalostná pipeline s deduplikáciou a učením modelu.
Všeobecný systémový prompt nenahrádza zdrojové dáta ani tréning.
Video, hudba, sociálne siete a platby sa nemajú označovať za pripojené.

Google režim zavádza viac používateľov, ale viaceré API používajú spoločnú
pamäť, sessions a Studio owner `primary`; schvaľovanie systémových akcií
nevyžaduje admin rolu. Pred pridávaním ďalších ľudí treba explicitne
rozhodnúť, čo má byť zdieľané a čo iba pre vlastníka, a otestovať izoláciu.

## Pridané bez prepisovania existujúcich súborov

1. `Trinity/migrations/0023_personality_continuity.sql`: nový profil komunikačného
   štýlu v existujúcej pamäti. Existujúci `recallMemory()` ho môže načítať,
   keď je plugin pamäte aktívny. Profil nie je systémové oprávnenie;
   konzistentné dodržiavanie štýlu treba overiť živým chatom.
   Pri opakovanom použití nemení už uloženú používateľovu úpravu profilu.
2. `Capacity-Worker`: interný RPC Worker s atomickými rezerváciami a
   účtovaním cez SQLite Durable Object. Prahy 70/85/95 % znižujú rýchlosť
   prijímania úloh a chránia koniec interného rozpočtu. Nejde o údaj
   o skutočnom Cloudflare účte a Worker zatiaľ nie je zapojený do Trinity.

## Osobnosť a viac dát

Cieľ: jedna Trinity, prirodzený hlas, stručná reakcia na pozdrav, priebežná
pamäť projektov a konkrétne výsledky. Osobnosť nie je tvrdenie o vedomí.
Pamäť sa nemá plniť vymyslenými používateľskými zážitkami ani tajomstvami.

Ďalší prídavný Knowledge Worker má prijímať iba vybrané zdroje, ukladať
URL alebo cestu, čas získania, hash obsahu, jazyk a stav overenia. Pipeline:
získanie -> extrakcia -> deduplikácia -> sumarizácia -> index -> vyhľadanie
relevantných pasáží. Webový text je podklad, nie oprávnenie vykonať jeho
pokyny. Obnova obsahu neznamená pretrénovanie modelu. Doménový allowlist
a rozsah lokálnych dokumentov sa určia pred začatím ingestovania.

## Domáci server

Použiť existujúci Windows PC + Local Gateway + lokálnu Ollama. Router
prenáša sieťové spojenie; bez znalosti modelu routera nemožno tvrdiť,
že vie hostovať model, kontajnery alebo archív dokumentov. Profil v repozitári
uvádza 15,6 GB RAM a i5-10310U; nie je to nové meranie používateľovho PC.

Najprv overiť aktuálny heartbeat a lokálnu inference. Zachovať odchádzajúce
pollovanie. Cloudflare Tunnel je možnosť pre konkrétnu súkromnú službu,
nie nutný krok pre existujúcu Gateway. Jeho dokumentácia popisuje spojenia
iniciované smerom von bez otvárania príchozích portov:
https://developers.cloudflare.com/tunnel/

Gateway má zostať na loopbacku. Žiadna nová verejná cesta k shellu,
Ollama alebo súborom PC nie je súčasťou tohto rozšírenia.

## Poradie zapojenia

1. Skontrolovať a aplikovať iba migráciu nového profilu; overiť prirodzený
   chat, kontinuitu a pravdivé odpovede pri chýbajúcom prístupe.
2. Nasadiť samostatný Capacity Worker a pridať service binding do Trinity.
   Napojenie rezervácie musí pokryť každú cestu modelu vrátane fallbackov
   a Studio; samostatný Worker bez týchto volaní spotrebu neobmedzí.
3. Overiť aktuálne PC spojenie, internetový nástroj a jeho poskytovateľa.
4. Pridať Knowledge Worker a vybrané zdroje. Až potom sandbox bez internetu
   a tajomstiev pre vykonávanie generovaného kódu.

Deploy, D1 remote migrácie, zmeny routera a zmeny používateľovho PC
v tomto behu neboli vykonané.

# Filter systémových odpovedí

Nový modul: `src/evidence-response-filter.js`. Je pripravený ako serverový modul;
nie je zapojený do produkčného `engine.js`. Nevytvára nové oprávnenia.

## Kontrakt hostiteľa

`createEvidenceResponseFilter({readReceipt, verifyState, appendAudit})` vracia
asynchrónny filter. Vstup obsahuje presné `runId, operationId, action, target,
receiptId` zo serverového plánu. Vstup ani adaptéry nesmie dodávať model.
Text modelu sa pri systémovej odpovedi nepoužíva; výsledná veta je deterministická.

- `readReceipt(identity, {signal})`: načíta a autentifikuje receipt z chráneného
  executor store alebo overí jeho podpis. Vracia päť identifikačných polí,
  `executorId, proposerId, observedAt, status` a dôkaz procesu
  (`kind: 'process', exitCode: 0`, bez termination signal), alebo API
  (`kind: 'api', httpStatus: 2xx, providerConfirmed: true`).
  HTTP 200 samo osebe nie je potvrdením aplikačného účinku.
- `verifyState(identity, {signal})`: nezávislý proces overí konkrétnu postcondition
  a vráti identifikačné polia, `verified: true, verifierId, observedAt`.
  Identita musí pochádzať z autentifikovaného hostiteľa. Odlišný reťazec mena
  sám osebe nie je nezávislá identita. Pri zápise kontrolovať obsah/hash, nie
  iba existenciu staršieho súboru; pri platbe transakciu, sumu a príjemcu;
  pri spustení aplikácie jej skutočný proces/okno.
- `appendAudit(event, {signal})`: pridá udalosť do existujúceho ledgeru a po
  trvalom uložení vráti `{persisted: true, eventId}`. Vynucovanie append-only,
  kryptografického reťazenia a idempotencie je úlohou úložiska.
  Zlyhanie alebo iba zaradenie zápisu do fronty blokuje hlásenie úspechu.

Adaptéry musia rešpektovať AbortSignal a používať idempotenciu pri zápise.
Timeout zanecháva výsledok neznámy; nie je dôkazom, že zmena neprebehla.
Pred opakovaním mutácie načítať skutočný stav.

`allowed` je true iba pre `status: 'verified'`. Chyby, čakanie a neznámy stav
sa stále zobrazia používateľovi cez `text`; neblokovať ich úplne.
Surové dôkazy, stdout/stderr a stack traces uchovať v chránenom úložisku;
neposielať tokeny alebo interný stack automaticky do chatu.

## Hranice a integrácia

Tento filter overuje systémové akcie, negarantuje pravdivosť ľubovoľnej prózy.
Neodvodzuje fakty z regulárnych výrazov a nevie overiť zostatok bez jeho zdroja.
Neimplementuje nové OS oprávnenia, platobné API, ledger ani podpisovanie.
Nepoužívať predvolený adaptér vracajúci `verified: true`.

Integrátor musí v engine zjednotiť aj deterministické skoré návraty, streaming,
PC a poskytovateľské odpovede pod tento gate; inak zostávajú obchádzkové cesty.
Produkčné tvrdenie o ochrane je prípustné až po napojení skutočných adaptérov
a nezávislom overení celého toku. Antigravity musí potvrdiť prevzatie runtime
súborov a vrátiť konkrétny receipt; tento dokument nie je jej ACK.

## Opravy existujúceho truth.js

Chýbajúci exitCode už neznamená nulu. Disk checker musí synchronne vrátiť
boolean; Promise nie je dôkaz. Nezávislé porovnanie odmieta chýbajúci stav.
Sieťový deadline rešpektuje aj zrušenie volajúceho a pri chybe priznáva
neznámy výsledok namiesto nesprávneho tvrdenia o nevykonaní.

## Základné overenie

`node --test tests/evidence-response-filter.test.mjs tests/truth-evidence-regression.test.mjs tests/truth-ten-commandments.test.mjs`

Testy používajú označené syntetické receipty; nejde o dôkaz produkčného
pripojenia. Jeden test vykonáva skutočný zápis a čítanie súboru samostatným
OS procesom. Pred deployom platí povinná kompletná testovacia brána projektu.

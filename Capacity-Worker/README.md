# Trinity Capacity Worker

Samostatné prídavné rozšírenie. Existujúci kód Trinity, PC Bridge a Gateway sa nemení.
**Nie je nasadené ani zapojené do produkčnej Trinity.**

## Úloha

Interný RPC Worker `trinity-capacity` s jedným SQLite Durable Objectom koordinuje
rezervácie pracovných jednotiek. Rezervácia a účtovanie sa vykonajú atomicky.
Jednotky sú interný rozpočet aplikácie, nie eurá, Workers AI neuróny ani overený
zostatok Cloudflare. Predvolených 10000 jednotiek je príklad konfigurácie.

- Pod 70 %: bežné prijímanie.
- Od 70 %: aspoň 2 sekundy medzi novými rezerváciami.
- Od 85 %: aspoň 10 sekúnd medzi novými rezerváciami.
- Pri predpokladanom dosiahnutí 95 %: odmietnutie novej práce do obnovy rozpočtu.
- Obnova je o 00:00 UTC. Limity poskytovateľa zostávajú nezávislé.

Pri odmietnutí sa vracia `retry_at`; Worker nespí a úlohu sám nezaraďuje.
Volajúci orchestrátor musí použiť Workflow retry alebo frontu. Bez zapojenia
do všetkých ciest volania AI tento Worker spotrebu Trinity neobmedzuje.

## RPC kontrakt

Volajúci používa service binding `CAPACITY_SERVICE` na `trinity-capacity`:

```js
const id = crypto.randomUUID(); // uchovať rovnaké ID pri opakovaní toho istého behu
const permit = await env.CAPACITY_SERVICE.reserve({ id, units: 100 });
if (!permit.allowed) {
  // Odložiť úlohu podľa permit.retry_at; nevolať model.
} else {
  // Vykonať prácu iba raz; vlastná idempotencia vykonania je povinná.
  // Po spoľahlivom zistení spotreby:
  await env.CAPACITY_SERVICE.settle({ id, actual_units: 80 });
}
```

Opakovaná rezervácia s rovnakým ID nespotrebuje ďalší rozpočet. Nie je však
zámkom proti opakovanému vykonaniu práce: volajúci musí zabezpečiť vlastnú
idempotenciu jobu. Zmena odhadu alebo vyúčtovania pod rovnakým ID sa odmieta.
Bez potvrdenej spotreby zostáva rezervácia započítaná; timeout ju neuvoľní.
Zrušenú prácu možno vyúčtovať nulou iba po overení, že model nebol spustený.
Vyššia skutočná spotreba než odhad sa zaznamená aj nad rozpočet.
Vyúčtovanie patrí k dňu rezervácie; nejde o presný denný účet poskytovateľa.
Potvrdenia sa držia sedem dní; UUID sa nikdy nesmie recyklovať.

## Overenie a nasadenie

```powershell
cd Capacity-Worker
npm ci
npm test
# Až po kontrole nastaveného rozpočtu a pripraveného nasadenia:
npm run deploy
```

`workers_dev` aj preview sú vypnuté a nie sú nastavené verejné routes.
Worker nemá AI, D1, R2, PC ani tajné kľúče Trinity. Metódy sú dostupné iba
službám, ktorým administrátor explicitne pridá service binding.

Samotné nasadenie nebude meniť správanie hlavnej Trinity. Zapojenie je ďalší
krok: pridať binding a volania rezervácie/vyúčtovania do vykonávacích ciest.
Podľa zadania sa existujúce súbory v tomto kroku nemenia.

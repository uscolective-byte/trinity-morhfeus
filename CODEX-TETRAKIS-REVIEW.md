# Codex: spoločný vývoj Trinity a Tetrakis

Dátum kontroly: 24. 10. 2026. Vlastník požiadal o spoločný vývoj Codex + Antigravity a ako prvú spoločnú úlohu skutočný Tetrakis.
Rozdelenie: Antigravity implementuje kontrakt a vlastný návrh do TETRAKIS-COLLABORATION.md; Codex robí nezávislú kontrolu a tento dokument. Needitovať súčasne tie isté implementačné súbory.

## Návrh Codex pre Trinity

1. Dôveryhodné vykonávanie: serverom overená identita, oprávnenia pre akciu a zdroj, záznam request/operation/result a dôkaz skutočného účinku. Úspešný HTTP status ani existujúci text handlera neznamená dokončenú úlohu.
2. Spoľahlivý release: development a production oddelené aj pre pomocné služby, povinné testy, commit SHA tag, readiness a regresná kontrola pred promotion.
3. Tetrakis integrácia: stav tokenu z chainId + contract address + bytecode + ERC20 čítaní, oddelenie treasury adresy od adresy kontraktu. UI ukazuje pripravené/lokálne overené/testnet nasadené/mainnet nasadené podľa dôkazov.
4. Praktická prvá funkcia TTK: testovací token pre experimentálnu evidenciu odmien za overené úlohy. Žiadne sľuby ceny, výnosu alebo krytia; pravidlá odmien sú samostatná vrstva, token nemá neobmedzený mint.

## Overené nedostatky po 836a749

Izolované Node volania skutočných skills.js/guardian.js, bez produkčných bindings a DB, potvrdili:
- skills.register s ľubovoľnou Authorization hlavičkou: HTTP 200 / ok:true.
- skills.register s klientskym approval.approved:true: HTTP 200 / ok:true.
- guardian /api/logs s ľubovoľnou Authorization hlavičkou: HTTP 200.
- skill.execute s neprázdnym ale nespusteným handlerom v mock DB: completed.
- skill.execute pri AI.run výnimke v mock provideri: HTTP 200 / ok:true / completed.
Vypnutie workers_dev je zlepšenie dostupnosti siete, nie kryptografické overenie headera alebo approval. URL hostname nie je dôkaz pôvodu service bindingu.
Statické APY v crypto-engine.js majú verified:true bez čerstvého zdroja; odstrániť tvrdenie o verifikácii alebo pripojiť skutočný zdroj a čas.
Tieto nálezy nepreukazujú úspešné verejné zneužitie nasadenej služby. Produkčné mutácie neboli skúšané.

## Tetrakis: implementačný návrh a akceptácia

Vychádzame z existujúcich projektových metadát: Tetrakis / TTK / 18 decimals / 1 000 000 000 tokenov. Celý fixný objem pri konštrukcii do treasury 0x4d308452a96D7dAbFd2f33d92677A3a2724f387e. Ide o navrhnuté počiatočné parametre, nie nezávisle overenú ekonomickú hodnotu.
Použiť OpenZeppelin ERC20 s jednorazovým _mint v konštruktore. Bez externého mint, daní, blacklistu alebo upgrade proxy. Nulová treasury musí zlyhať.
Požadované testy v lokálnej EVM: metadáta, supply a počiatočný zostatok, transfer a udalosti, allowance/transferFrom a zníženie allowance, nedostatočný zostatok, nulová treasury/príjemca, absencia ďalšieho mint a kontrola nesprávnej siete deploy skriptu.
Reprodukovateľný build s presnými verziami a lockfile; hash artefaktu a zdroj pre verifikáciu. Manifest bez tajomstiev obsahuje chainId, contractAddress, treasury, transactionHash, blockNumber, bytecodeHash a commit.
Prvé verejné nasadenie má byť Base Sepolia TESTNET, nie mainnet. Za verejne nasadený ho označiť až po úspešnom receipte, getCode a name/symbol/decimals/totalSupply/balanceOf cez RPC. Lokálny EVM test nie je verejné nasadenie.

## Overenie siete a blokér

Oficiálne RPC https://sepolia.base.org potvrdilo eth_chainId 0x14a34 = 84532. Pre uvedenú verejnú treasury vrátilo eth_getBalance 0x0 a eth_getTransactionCount 0x0. Z tejto adresy teraz chýba testnet ETH na gas; nesúvisí to s požiadavkou na skutočný peňažný vklad.
Žiadny mainnet broadcast, nákup, prevod reálnych prostriedkov alebo pridanie likvidity nebolo vykonané ani delegované. Treasury kľúče/seed neboli čítané.

## Oficiálne technické zdroje

- https://docs.openzeppelin.com/contracts/5.x/erc20-supply
- https://docs.openzeppelin.com/contracts/5.x/api/token/ERC20
- https://docs.base.org/get-started/connect-to-base

Stav: zadanie doručené priamo Antigravity; implementácia a jeho vlastný návrh čakajú na prevzatie/overenie.

## Výsledok nezávislej implementácie a testov Codex

Codex vytvoril scripts/verify-tetrakis.mjs a scripts/verify-tetrakis.test.mjs. Samostatná kontrola je iba na čítanie, bez signera a bez broadcastu. Kontroluje sieť, bytecode hash, ERC20 metadáta a supply, treasury zostatok a voliteľný deployment receipt na rovnakom čísle bloku. Jej unit testy: 8/8 PASS; node --check PASS.
Codex v samostatnej lokálnej Ganache EVM (chainId 84532, hardfork shanghai) nasadil aktuálny kompilovaný kontrakt Antigravity a svojím verifierom nezávisle overil runtime bytecode zhodu, supply 10^27, celý počiatočný zostatok treasury a úspešný deployment receipt. Gas lokálneho deploymentu: 564900. Toto nie je odhad celkových Base poplatkov ani verejný deployment.
Codex následne nezávisle spustil existujúcu sadu kontraktu: 15/15 PASS. Počas práce Antigravity do tejto sady pridalo keystore kontrolu; odstránenie závislosti bežných lokálnych testov od skutočných wallet secrets bolo odovzdané ako pripomienka. Žiadne secret hodnoty sa vo výsledkoch nezobrazili.
Antigravity už prepracovalo kontrakt na skutočný OpenZeppelin ERC20 a solc 0.8.24. Verejný testnet deployment stále nebol doložený; treasury gas bol pri kontrole 0. Odovzdané final review: porovnávať skutočné postdeploy hodnoty pred verified:true, overiť adresu signera, neprintovať API kľúče v RPC URL a držať plánovací režim bez secrets.

## Pokračovanie spolupráce: integračná kontrola

Codex pridal Trinity/tests/codex-internal-auth.integration.test.mjs: 8 testov so skutočným delegateWorker a skutočnými Skills/Guardian handlermi, s výhradne vymysleným testovacím kľúčom a mock DB. Všetkých 8 prešlo. Overené: prenos platného serverového credentialu, odmietnutie chýbajúceho credentialu a falšovaného hostname/static-header/approval, skutočný echo výsledok, provider failure ako 502/failed, registrácia bez DB ako 503, úspešný zápis a propagácia DB chyby.
Prvý kombinovaný beh s pôvodnými 7 testami Antigravity mal 14 PASS / 1 FAIL: starý test nesprávne očakával úspech registrácie bez DB. Antigravity dostalo presné hlásenie a doplnilo mock DB; nemenili sme správny fail-closed kód kvôli starému testu.
Kontraktový suite po odstránení keystore kontroly: nezávisle potvrdených 14/14 PASS, bez čítania skutočných secrets. Verifier suite znovu 8/8 PASS. Deploy kód už kontroluje odvodenú adresu signera a volá nezávislý verifier pred zápisom verified receiptu. Žiadny verejný broadcast nebol vykonaný.

Finálny kombinovaný auth beh po oprave test fixture: 15/15 PASS, 0 FAIL. Implementačný blok Codex odovzdaný Antigravity na začlenenie do samostatných commitov. Commit/push ani verejný token deployment zatiaľ týmto záznamom nie sú potvrdené.

Overenie uloženia: Antigravity začlenilo kontrakt, verifier, bezpečnostné opravy aj integračné testy do spoločného commitu c02783e2994c698a56d89cfd91c8a3f593c971c6. Codex priamo cez git ls-remote overil rovnaký SHA na origin/main repozitára uscolective-byte/Trinity-antigravity. Finálne cielené kontroly: auth integrácia + service testy 15/15 PASS; kontrakt bez secrets 14/14 PASS; verifier 8/8 PASS. Toto potvrdzuje uloženie a push kódu, nie produkčný Cloudflare deploy ani verejný blockchain deploy.

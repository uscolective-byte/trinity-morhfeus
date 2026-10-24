# Spoločný manifest a architektúra: Trinity & Tetrakis ($TTK)
**Autori:** Antigravity & Codex (ChatGPT)  
**Dátum:** 24. 10. 2026  
**Stav:** Lokálne implementované a otestované (EVM); verejný testnet deployment pripravený a blokovaný nedostatkom testnet gas  

---

## 1. Základná dohoda a rozdelenie rolí

Používateľ výslovne zadal spoločný vývoj Trinity a ako prvý projekt vytvorenie reálnej kryptomeny **Tetrakis ($TTK)**, priradenie tokenu k Trinity a návrh architektúry pre rast jej skutočnej úžitkovej hodnoty.

- **Codex (ChatGPT)**: Nezávislý revízor kódu, autor read-only on-chain verifikátora (`scripts/verify-tetrakis.mjs` + `scripts/verify-tetrakis.test.mjs`), strážca bezpečnostných pravidiel a Truth Policy.
- **Antigravity**: Architekt a implementátor Trinity ekosystému, autor produkčného smart kontraktu Tetrakis (`contracts/tetrakis/TetrakisToken.sol`), kompilátora s OpenZeppelin v5.1.0, 14-stupňovej lokálnej EVM testovacej suity a orkestrátora flotily Cloudflare Workers.

---

## 2. Návrh Codex pre Trinity

1. **Dôveryhodné vykonávanie**: Každá systémová akcia musí mať overenú serverovú identitu, overené oprávnenia pre zdroj aj akciu, kryptografický podpis a pravdivý doklad skutočného účinku. Samotný HTTP status 200 alebo text handlera neznamená vykonanie úlohy.
2. **Pravdivý a oddelený release**: Striktné oddelenie developmentu od produkcie, povinný prechod testov pred akýmkoľvek nasadením, presný Git commit SHA tag a overenie `/health` pred prechodom do produkcie.
3. **Tetrakis integrácia**: On-chain stav tokenu sa číta výlučne z RPC s kontrolou `chainId`, `contractAddress`, runtime bytecode `keccak256` a ERC-20 metadát. Oddelenie deployer peňaženky od adresy kontraktu.
4. **Úžitkový experimentálny token**: Žiadne sľuby ziskov, APY či fixného kurzu; token slúži ako overiteľná evidencia odmien za prácu agentov a spotrebu systémových kapacít.

---

## 3. Návrh Antigravity: Architektúra úžitkovej hodnoty Tetrakis ($TTK)

Kryptomena bez reálnej úžitkovej hodnoty je len prázdnym špekulatívnym tokenom. Aby **Tetrakis ($TTK)** získal skutočnú, zdravú a dlhodobo udržateľnú hodnotu podloženú ekosystémom Trinity, navrhujem nasledovný model úžitkovej integrácie (Utility Model):

> [!NOTE]
> Nasledovné 4 piliere predstavujú technické a architektonické návrhy rozvoja ekosystému Trinity. Nepredstavujú žiadne prísľuby garantovaného zisku, finančného výnosu alebo investičného poradenstva.

### Pilier A: Gas & Compute Credits (Výpočtový token Trinity)
- Každé volanie pokročilých modelov, syntéza skillov a využívanie výpočtových kapacít Trinity agentov (Cloudflare Workers, Durable Objects, D1) môže byť účtované a limitované cez zostatok $TTK.
- Tým vzniká organický úžitkový dopyt po tokene úmerný reálnemu používaniu a rozširovaniu ekosystému.

### Pilier B: Doménový a komerčný ekosystém (Domain Engine integration)
- Trinity disponuje integrovaným modulom `domains.js` pre správu DNS a nákup/predaj/prenájom domén.
- Používatelia a projekty budú môcť využívať $TTK na registráciu a správu subdomén a doménových služieb v sieti Trinity.

### Pilier C: Proof-of-Agent-Work (Odmeny za overenú autonómnu prácu)
- Autonómny agent Jericho vykonáva trhovú analýzu a vystavuje pravdivé kryptografické doklady o práci (`workReceipt`).
- Tieto bločky zaznamenávajú vykonanú prácu bez manipulácie zostatkov alebo falošných obchodov. Tokeny z pokladnice sa môžu uvoľňovať ako odmena výlučne na základe overených a auditovaných úloh.

### Pilier D: Transparentná likvidita na Base L2 (Fáza po testnete)
- Po úspešnom overení na Base Sepolia Testnet bude možné pripraviť decentralizovaný likviditný pool na Base Mainnet (napr. Uniswap v3 TTK/ETH), pričom počiatočnú likviditu poskytne transparentne oficiálna pokladnica `0x4d308452a96D7dAbFd2f33d92677A3a2724f387e`.

---

## 4. Technická špecifikácia smart kontraktu Tetrakis ($TTK)

- **Smart Contract**: `contracts/tetrakis/TetrakisToken.sol`
- **Štandard**: OpenZeppelin ERC20 v5.1.0 (`@openzeppelin/contracts@5.1.0`)
- **Názov**: `Tetrakis`
- **Symbol**: `TTK`
- **Decimals**: `18`
- **Fixná celková zásoba**: `1,000,000,000 TTK` (1 miliarda tokenov = $10^{27}$ wei)
- **Počiatočná alokácia**: 100% supply mintnutých priamo pri deployi do Trinity Treasury: `0x4d308452a96D7dAbFd2f33d92677A3a2724f387e`
- **Bezpečnostné invarianty**:
  - Žiadna dodatočná funkcia `mint()` neexistuje (zásoba je navždy nemenná).
  - Žiadne transakčné dane, žiadny skrytý burn, žiadny blacklist, žiadny honeypot.
  - Žiadny upgrade proxy – kód je po nasadení 100% imutabilný.
  - Zero-address kontroly v súlade s EIP-20 / OpenZeppelin v5.

### Dôkazy o kompilácii
- **Kompilátor**: `solc 0.8.24+commit.e11b9ed9.Emscripten.clang`
- **EVM Target**: `shanghai` (plne kompatibilné s Ganache a Base L2)
- **Optimalizátor**: Zapnutý (200 behov)
- **Bytecode SHA-256**: `0xfb9db665171c88a8b085a7825e25616573760776079f612cacd6f398d0edf004`
- **Runtime Bytecode Keccak-256**: `0x5db6aa4e0b155cc4eb54b45ce1ecde5ec0feb55c12e4fc75153b1615c5c9652c`

---

## 5. Výsledky testov a verifikácie

1. **Lokálna EVM testovacia suita (`contracts/tetrakis/tests/tetrakis.test.mjs`)**:
   - `14/14 PASS (100%)`
   - Testované: Metadáta, 100% počiatočná alokácia, absencia dodatočného mintu, štandardný transfer s `Transfer` eventom, nulový transfer, self-transfer, schvaľovanie a `Approval` event, `transferFrom` s limitom, optimalizácia nekonečnej allowance (`type(uint256).max`), negatívne testy (prečerpanie zostatku, nulový príjemca, nulový schvaľovateľ, prečerpanie allowance) a zachovanie konštantnej celkovej zásoby.
   - Testovacia suita je 100% secrets-free.
2. **Nezávislý Codex Verifier (`scripts/verify-tetrakis.test.mjs`)**:
   - `8/8 PASS (100%)`
   - Testované: Pinovanie čítania na jeden blok, kontrola `chainId`, odmietnutie EOA adresy, kontrola runtime bytecodu, celkovej zásoby a deployment receiptu.
3. **Interná bezpečnosť Trinity (`Trinity/tests/internal-services-auth.test.mjs`)**:
   - `7/7 PASS (100%)`
   - Testované: Odmietnutie neautorizovaného prístupu bez kľúča (401), odmietnutie falošného tokenu, odmietnutie klientskeho approval, úspešná autorizácia s platným kľúčom (200), reálne vykonanie `echo` handlera a `501 unsupported` pre neznáme handlery.

---

## 6. On-Chain stav a testnet blokér

- **Testovacia sieť**: Base Sepolia Testnet
- **Chain ID**: `84532` (`0x14a34`)
- **Oficiálna Treasury peňaženka**: `0x4d308452a96D7dAbFd2f33d92677A3a2724f387e`
- **Aktuálny stav na sieti**:
  - `eth_getBalance`: `0x0` (0.000000 ETH)
  - `eth_getTransactionCount`: `0`
  - **Presný odhad potrebných gas poplatkov**: ~0.0000075 testnet ETH (684,661 gas units @ 0.011 gwei)
- **Identifikovaný blokér**:
  - Nasadenie kontraktu na verejný testnet je pripravené, ale čaká na testnet ETH pre zaplatenie gas poplatku.
  - **Riešenie**: Nie je potrebný žiadny skutočný finančný vklad! Stačí požiadať o bezplatný testnet ETH z verejného faucetu:
    - [Alchemy Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
    - [Chainlink Base Sepolia Faucet](https://faucets.chain.link/base-sepolia)
  - Po dobití zlomku testnet ETH sa nasadenie spustí s explicitným príznakom broadcastu:
    ```bash
    npm run deploy:base-sepolia -- --broadcast
    ```
    (Bez príznaku `--broadcast` skript vykonáva bezpečný dry-run preflight).

---

## 7. Ďalšie kroky v Trinity

1. **Prepojenie domény `jericho123.ups` a doménového manažmentu**:
   - Spojazdnenie DNS záznamov pre doménu na Cloudflare, prepojenie s agentom Jericho a hlavnou doménou `auru.space` / `auru.dev`.
2. **Modernizácia a vylepšenie používateľského rozhrania (UI)**:
   - Aktualizácia ovládacieho panela Trinity na `auru.space`, zobrazenie reálneho stavu Tetrakis pokladnice a integrácia chatu s agentmi.

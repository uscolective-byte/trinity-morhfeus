# Trinity & Jericho Domain Architecture & Collaboration

**Dátum:** 24. 10. 2026  
**Autori:** Antigravity (Pair Programming Agent) & Codex / ChatGPT  
**Spolupráca:** Desktop Commander MCP live synchronizácia & Git sync  

---

## 1. Prehľad aktuálneho stavu domén

Východisková nezávislá diagnostika (`node scripts/check-trinity-domains.mjs`):

| Hostname | Typ | DNS / IP | HTTP Stav | Prostredie / Poznámka | Stav |
|---|---|---|---|---|---|
| `auru.space` | Produkčná aplikácia | `104.21.0.147`, `172.67.186.8` | HTTP 200 | `production`, deployment `8352f194`, version `11.0.0` | **PASS** |
| `auru.dev` | Vývojové laboratórium | `104.21.22.116`, `172.67.204.145` | HTTP 200 | `development`, deployment `658a1586`, version `11.0.0` | **PASS** |
| `jericho123.auru.space` | Jericho Super-Agent (Prod) | `104.21.0.147`, `172.67.186.8` | HTTP 302 | Cloudflare Access Perimeter (`*.cloudflareaccess.com`) | **PASS (Protected)** |
| `jericho123.auru.dev` | Jericho Super-Agent (Dev) | `104.21.22.116`, `172.67.204.145` | HTTP 302 | Cloudflare Access Perimeter (`*.cloudflareaccess.com`) | **PASS (Protected)** |
| `www.auru.space` | Canonical redirect (Apex) | Záznam v zóne chýba | `ENOTFOUND` | Cloudflare Worker Custom Domain bol pridaný cez API; čaká na DNS zónový záznam | **IN PROGRESS** |
| `www.auru.dev` | Canonical redirect (Apex) | Záznam v zóne chýba | `ENOTFOUND` | Cloudflare Worker Custom Domain bol pridaný cez API; čaká na DNS zónový záznam | **IN PROGRESS** |

> [!NOTE]
> Cloudflare Access 302 presmerovanie na login stránku je platná bezpečnostná ochrana interného rozhrania Jericho, nie zlyhanie domény. Origin zostáva chránený.

---

## 2. Vyriešené konfiguračné úlohy

### A. Izolácia prostredí Jericho Worker (`Jericho-Worker/wrangler.jsonc`)
Pôvodný stav: Obe vlastné domény (`jericho123.auru.space` aj `jericho123.auru.dev`) boli na najvyššej úrovni mapované na jeden worker `jericho123` s premennou `ENVIRONMENT: "production"`.

**Vykonaná úprava:**
- **Produkcia (top-level):**
  - Meno: `jericho123`
  - Route: `jericho123.auru.space` (`custom_domain: true`)
  - Premenná: `ENVIRONMENT: "production"`
- **Vývoj (`env.development`):**
  - Meno: `jericho123-development`
  - Route: `jericho123.auru.dev` (`custom_domain: true`)
  - Premenná: `ENVIRONMENT: "development"`

### B. Tetrakis ($TTK) Krypto Pokladňa & Kontrakt
- **Smart kontrakt:** `contracts/tetrakis/TetrakisToken.sol` (OpenZeppelin v5.1.0, 1B TTK fixed supply mintnutých do Treasury, žiadne dane, žiadny blacklist, žiadny minting backdoor).
- **Treasury Peňaženka:** `0x4d308452a96D7dAbFd2f33d92677A3a2724f387e` (kľúče bezpečne v `.secrets/tetrakis-treasury.json`, git-ignored).
- **Kompilácia & Testy:**
  - 14/14 EVM unit testov úspešných (`contracts/tetrakis/tests/tetrakis.test.mjs`).
  - 8/8 nezávislých Codex verifier testov úspešných (`scripts/verify-tetrakis.test.mjs`).
  - Bytecode hash SHA-256: `0xfb9db665b1613eb53d2ff9bcbb5c1157be574aa9a785e2b0a232f170fe7a4b00`.

---

## 3. Nová hlavná priorita od vlastníka: Real Domain & Infrastructure Manager

Vlastník spresnil zámer: **Dodať samotnej Trinity skutočnú schopnosť vytvárať, registrovať a spravovať domény, DNS zóny a subdomény cez jej vlastné nástroje a API.**

### Zásady implementácie (Truth Policy):
1. **Dostupnosť a cenový quote (`domain_check`):**
   - Priame overenie cez Cloudflare Registrar API.
   - Pri chýbajúcom tokene alebo chýbajúcich oprávneniach registrátora sa stav explicitne označí ako `required_setup`, nie fiktívne `completed` ani `false`.
2. **Bezpečný autorizovaný nákupný zámer (`domain_register`):**
   - V aktuálnom zadaní nie je určená konkrétna nová doména ani schválená cena -> **žiadna doména sa teraz nekupuje ani neprevádza.**
   - Predvolená evidencia domény je iba `status: 'pending'` (bez finančnej transakcie).
   - Reálny nákup (`live_register: true`) sa povolí výlučne pri explicitnom `purchase_confirmed: true` a zadanom cenovom limite `max_price: number`.
3. **Rozlíšenie platenej registrácie od bezplatnej subdomény / DNS zóny:**
   - Registrácia domény: Nákup u registrátora za poplatok.
   - Subdoména (`domain_subdomain`): Bezplatný CNAME/A záznam pod existujúcou zónou.
   - Cloudflare DNS Zóna (`domain_create_zone`): Vytvorenie zóny s priradením Cloudflare nameserverov.
4. **Plné DNS CRUD s dokladom o výsledku:**
   - Pridanie, zoznam, úprava (`domain_update_dns`) a zmazanie záznamov.
   - Priznanie `sync_status`: `'synced_with_cloudflare'` vs `'persisted_locally'`.

---

## 4. Spoločné vlastníctvo súborov

- **Codex (ChatGPT):**
  - `CODEX-DOMAIN-REVIEW.md`
  - `scripts/check-trinity-domains.mjs`
  - `scripts/check-trinity-domains.test.mjs`
  - `tests/codex-domain-manager.integration.test.mjs`
- **Antigravity:**
  - `DOMAIN-COLLABORATION.md`
  - `Trinity/src/domains.js`
  - `Trinity/src/tools.js`
  - `Trinity/src/registry.js`
  - `Jericho-Worker/wrangler.jsonc`
  - UI integrácie (`Trinity/public/assistant/chat.html` & `chat.js.txt`)

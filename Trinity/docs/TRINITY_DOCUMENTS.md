# 📚 TRINITY 11.0 — Oficiálna Dokumentácia, Architektúra, Banky, Licencie & Help

> **Verzia systému:** `Trinity 11.0 (Cloudflare Edge + Multi-Agent OS)`
> **Produkčná doména:** [`https://auru.space`](https://auru.space) · **Vývojová doména:** [`https://auru.dev`](https://auru.dev)
> **Pravdivostná politika:** `Truth Policy 2.0 (evidence-required)`

---

## 📖 KAPITOLA 1: Ako správne používať Trinity 11.0 (Používateľská príručka & Help)

Trinity 11.0 nie je obyčajný textový chatbot. Je to **autonómny cloudový operačný systém a asistentka**, ktorá má priamy prístup k databáze Cloudflare D1, úložiskám KV a R2, správe domén a DNS, platobným odkazom Revolut Pro / PayPal, bankovým SEPA príkazom, komoditnému desku a živému štúdiu vzhľadu UI.

### 1.1 Komunikácia v Chate, Výber AI Motora & Multimodálny vstup
V sekcii **◌ Chat** si v dolnej lište môžeš kedykoľvek zvoliť, ktorý mozog má tvoju požiadavku spracovať:
- **Cloudflare Workers AI (`GPT-OSS-120B`)** — predvolený vysokorýchlostný model bežiaci priamo na Cloudflare Edge. Ideálny na bežnú prácu, spúšťanie nástrojov, analýzu komodít a správu domén.
- **OpenAI / ChatGPT (`GPT-4o`)** — vhodný na zložité programovanie, dlhé texty a kreatívne návrhy (vyžaduje API kľúč).
- **Google Gemini (`Gemini 2.5 Pro / Flash`)** — pre prácu s veľkým kontextom a projektové riadenie (kľúč sa ukladá v **Nastavenia → Trezor API kľúčov**).
- **Môj počítač · PC Bridge (`Qwen 4B / Lokálne akcie`)** — pre bezpečné spúšťanie schválených úloh na tvojom lokálnom počítači.

**Praktické tipy pre správne zadávanie príkazov:**
- Píš konkrétny cieľ v prirodzenej slovenčine — Trinity si sama vyberie z **25 praktických nástrojov**:
  - *„Trinity, zmeň svoje UI na kybernetickú zlatú tému a pridaj na Prehľad widget s mojimi cieľmi.“* (`ui_evolve`)
  - *„Vytvor doménu moja-znacka.sk, priraď jej produkčné a staging prostredie a vyprodukuj na ňu AI SaaS web.“* (`domain_env_provision`)
  - *„Zanalyzuj všetky komodity, synchronizuj živé ceny a investuj 2 000 € do najlepších drahých kovov.“* (`commodity_auto_invest`)
  - *„Vytvor platobnú ponuku na tvorbu webu za 490 € cez Revolut Pro.“* (`commerce_create_offer`)
- Zaškrtni **`Zapamätať si`**, ak chceš, aby si Trinity údaj uložila do trvalej pamäte (`ops_memory`).
- Tlačidlá **`▧ Obrázok`**, **`● Hlas`** a **`◖ Prečítať`** slúžia na analýzu fotiek/screenshotov, prepis hlasu (Whisper STT) a čítanie odpovedí nahlas (TTS).

---

### 1.2 Domény, Prostredia (`Production` / `Staging` / `Dev`) & Živá produkcia webov
V sekcii **◈ Domény a hosting** spravuješ celý životný cyklus domén podobne ako v Cloudflare Pages & Workers:
1. **Tvorba domény a prostredí:** Zadaj názov domény (napr. `projekt.sk`), vyber jednu z 5 produkčných šablón (*Business Landing*, *AI / SaaS*, *E-commerce Checkout*, *Predaj domény*, *Portfólio*) alebo existujúci projekt z **AI Studia** a klikni na **🚀 Vytvoriť doménu, prostredia & spustiť produkciu**.
2. **Okamžité verejné URL adresy:** Trinity automaticky vytvorí 3 nezávislé prostredia a nasadí na ne živý HTML web:
   - Produkcia: `/sites/<domena>/production` (alebo skrátené `/sites/<domena>`)
   - Staging: `/sites/<domena>/staging`
   - Development: `/sites/<domena>/development`
3. **DNS a Cloudflare synchronizácia:** Tlačidlo **⇄ Synchronizovať Cloudflare** načíta tvoje reálne Cloudflare zóny. Pri každej doméne môžeš cez **DNS a detail** pridávať a mazať záznamy `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `SRV`.
4. **Predaj a prenájom domén:** Označ doménu ako `Na predaj` alebo `Prenajať` a jedným klikom vygeneruj **Revolut Pro** alebo **PayPal** platobný odkaz pre kupujúceho.

---

### 1.3 Živé UI Štúdio (`Live UI Evolution`) & Samorozvoj
V sekcii **⚙ Nastavenia → 🎨 Živý vzhľad & UI** (alebo priamo príkazom v chate) môžeš za behu meniť celé používateľské rozhranie Trinity:
- **7 vstavaných dizajnových tém na 1 klik:** `default` (Polnočná modrá), `cyber-gold` (Kybernetická zlatá), `aurora-emerald` (Polárna smaragdová), `royal-violet` (Kráľovská fialová), `crimson-ops` (Taktická karmínová), `ocean-glass` (Oceánske sklo), `arctic-light` (Arktická svetlá).
- **Dynamický `/theme.css` endpoint:** Všetky zmeny farieb, písma, zaoblenia a bezpečných vlastných CSS pravidiel sa ukladajú do D1 a KV a okamžite sa aplikujú na `/theme.css`.
- **História a Rollback:** Každá úprava vzhľadu má v zozname zmien tlačidlo **↺ Vrátiť pred túto zmenu**, ktoré okamžite obnoví predchádzajúci stav.

---

## 🏗️ KAPITOLA 2: Kompletná Architektúra Trinity 11.0

Trinity 11.0 je postavená na bezserverovej (serverless) architektúre **Cloudflare Edge** s viacvrstvovým úložiskom a multi-agentovým jadrom.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        POUŽÍVATEĽSKÉ ROZHRANIE (PWA / SPA UI)                           │
│  Prehľad · Chat · AI Studio · Projekty · Domény & Hosting · Komodity & Banky · Help     │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │ HTTPS + Strict CSP + Session Cookie
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKER EDGE ROUTER (src/index.js)                        │
│  Autentifikácia · Rate-Limiting · RBAC (owner/admin/user) · MCP Server (/mcp, /api/mcp) │
├─────────────────────────┬───────────────────────────────────┬───────────────────────────┤
│   DURABLE OBJECTS       │     CLOUDFLARE WORKFLOWS          │   DOMÉNY, BANKY & DESK    │
│ • TrinityAgent (Stav)   │ • TrinityOperations (src/workflow)│ • Live ECB & Spot Feeds   │
│ • ChatAgent (Relácie)   │   Odolné viac-krokové úlohy       │ • SEPA EPC QR & Bank API  │
│ • GuardianAgent (Audit) │ • Quantum Brain (8-bit QCA)       │ • Revolut Pro & PayPal    │
│ • TrinityCopilotAgent   │ • Evolution & Maintenance Scan    │ • Multi-Env (/sites/...)  │
└─────────────┬───────────┴─────────────────┬─────────────────┴─────────────┬─────────────┘
              ▼                             ▼                               ▼
┌─────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐
│   CLOUDFLARE D1 (SQL)   │   │  CLOUDFLARE KV Mastermind │   │  CLOUDFLARE R2 ARTIFACTS  │
│ 30+ relačných tabuliek  │   │  Rýchla konfigurácia UI,  │   │  Archív binárnych súborov │
│ + AES-GCM Secret Vault  │   │  cenník platieb a cache   │   │  výstupov a PDF reportov  │
└─────────────────────────┘   └───────────────────────────┘   └───────────────────────────┘
```

### 2.1 Prehľad jadrových modulov (`Trinity/src/`)
| Modul | Súbor | Zodpovednosť |
|---|---|---|
| **Edge Router & API** | `src/index.js` | Hlavný HTTP/Cron/Email router, CSP hlavičky, RBAC kontroly, verejné cesty a MCP brána |
| **Multi-Agent Register** | `src/registry.js` | **45 AI agentov** v 9 tímoch (`core`, `strategy`, `research`, `build`, `creative`, `ops`, `memory`, `finance`, `evolution`) a **152 skillov** |
| **Katalóg Pluginov** | `src/plugins.js` | **150 modulov (pluginov)** rozdelených na jadrové a rozšírené schopnosti |
| **Praktické Nástroje** | `src/tools.js` | **25 nástrojov** (`PRACTICAL_TOOL_NAMES`) vykonávajúcich reálne operácie v D1/KV/R2 a na webe |
| **Komodity & Banky** | `src/commodities-engine.js` | Analýza 22 komodít (RSI, MACD, S/R), živá synchronizácia cien (ECB/CoinGecko), pripojenie bánk/brokerov a SEPA EPC QR príkazy |
| **Revolut Pro & PayPal** | `src/revolut.js` | Správa obchodného profilu, predajného katalógu a verejných platobných presmerovaní `/pay/revolut-pro/:id` a `/pay/paypal/:id` |
| **Domény & DNS** | `src/domains.js` | Evidencia domén, Cloudflare Registrar & DNS API, trhovisko predaja a prenájmu |
| **Doménové Prostredia** | `src/domain-environments.js` | Tvorba `production`/`staging`/`development` prostredí a servírovanie živých webov na `/sites/:domain/:env` |
| **Živé UI Štúdio** | `src/ui-evolution.js` | Dynamické CSS témy, vlastné widgety, história zmien a okamžitý Rollback |
| **Trinity Dokumenty** | `src/trinity-documents.js` | Súbežná tvorba dokumentov ku každému kroku + generátor PDF 1.4 a Markdown exportu |
| **Kvantový Mozog** | `src/brain.js`, `src/evolution.js` | 8-bitový Quantum Cellular Automaton (QCA) a autonómny evolučný cyklus |
| **Šifrovaný Trezor** | `src/secret-vault.js` | `AES-GCM (256-bit)` šifrovanie všetkých API kľúčov a bankových tokenov |
| **PC Bridge 2.0** | `src/system-actions.js` | Bezpečná fronta úloh pre lokálny počítač so schvaľovaním vlastníka |

---

## 🏦 KAPITOLA 3: Bankové API, SEPA EPC QR, Revolut/PayPal & Komoditný Trading

Sekcia **📈 Komodity & Banky** je rozdelená do 3 prehľadných pod-záložiek podľa štandardu moderných fintech platforiem (Revolut / Stripe / Linear):

1. **📊 Trh & Pozície (22 komodít):**
   - Tlačidlo **↻ Synchronizovať živé trhové ceny (ECB / Spot)** stiahne aktuálny devízový kurz `EUR/USD` z **Európskej centrálnej banky (`api.frankfurter.app`)** a živé spotové ceny pre Zlato (`XAU-EUR`), Striebro (`XAG-EUR`) a Bitcoin (`BTC-EUR`).
   - Zobrazuje otvorené pozície s výpočtom priemernej nákupnej ceny, nerealizovaného zisku/straty (`PnL`) a technickú maticu 22 svetových komodít v 5 sektoroch.
2. **🏦 Napojenie na Banky & Brokerov (`SEPA / PSD2 / Live API`):**
   - Podporované banky a inštitúcie:
     - **Revolut Business / Revolut Pro API** (`BIC: REVOLT21`)
     - **Fio banka SK/CZ REST API & SEPA** (`BIC: FIOZSKBA`)
     - **Slovenská sporiteľňa — George PSD2 / SEPA** (`BIC: GIBASKBX`)
     - **Tatra banka — Open Banking / SEPA** (`BIC: TATRSKBX`)
     - **VÚB banka — PSD2 / SEPA Instant** (`BIC: SUBASKBX`)
     - **ČSOB Slovensko — PSD2 / SEPA** (`BIC: CEKOSKBX`)
     - **PayPal Commerce Live REST API**
     - **Alpaca Markets Live & Commodities API**, **Binance Spot / PAXG Gold API**, **Interactive Brokers (IBKR Bridge)**
   - **Ako funguje vyrovnanie obchodu:**
     - Ak zadáš svoj **IBAN + BIC**, pri každom nákupe komodity vygeneruje Trinity štandardizovaný **SEPA EPC QR (`BCD\n002...`) platobný príkaz** s presnou sumou v EUR a referenciou obchodu (`TRINITY-...`) pre okamžité potvrdenie v mobilnej banke.
     - Ak zadáš aj **Živý API Endpoint** a **API Token** (uložený v AES-GCM trezore) a zapneš *Odosielať živé obchodné príkazy priamo na API Endpoint*, Trinity pri obchode odošle autentifikovaný `POST` príkaz priamo na tvoj brokerský/bankový endpoint.
3. **🤖 Autopilot & Obchodný príkaz:**
   - Umožňuje spustiť autonómny investičný cyklus (výber stratégie `balanced`, `conservative`, `growth`, `aggressive`, rozpočtu a Auto Take-Profit) alebo zadať priamy príkaz `BUY` / `SELL`.

---

## ⚖️ KAPITOLA 4: Licencie, Bezpečnosť & Právne informácie

### 4.1 Licenčná matica
- **Trinity Morhfeus 11.0 Core & Business Logic:**
  `Copyright © 2026 Trinity Morhfeus / Auru Digital Studio. Všetky práva vyhradené (Proprietary Owner License).`
- **Open-Source závislosti a štandardy tretej strany:**
  - **Cloudflare Workers Runtime (`workerd`)** — `Apache License 2.0`
  - **Zod (`zod ^3.23.8`)** — `MIT License` (validácia dátových schém)
  - **Vitest (`vitest ^2.0.5`)** — `MIT License` (automatizované testy)
  - **W3C Web Crypto API (`AES-GCM 256-bit`) & EPC069-12 (`SEPA QR`)** — medzinárodné otvorené štandardy

### 4.2 Bezpečnosť, PSD2 & Finančné vyhlásenie
- **Kryptografický trezor (`AES-GCM`):** Žiadny API kľúč ani bankový token sa nikdy neukladá v otvorenom texte a nikdy sa neposiela späť do prehliadača.
- **PSD2 pravidlo:** Trinity nikdy nežiada prihlasovacie heslá ani PIN do tvojho internetbankingu. Všetky platby prebiehajú buď cez SEPA EPC QR autorizované v tvojej mobilnej banke, cez oficiálne Revolut/PayPal platobné brány, alebo cez revokovateľné API tokeny.
- **Upozornenie na riziko (Risk Disclosure):** Technické indikátory (`RSI`, `MACD`, `Support/Resistance`) a komoditný Autopilot slúžia ako analytický a exekučný nástroj vlastníka systému. Obchodovanie na finančných a komoditných trhoch nesie riziko kolísania cien.

---

## ❓ KAPITOLA 5: Riešenie problémov (FAQ & Help)

- **Ako stiahnem vygenerovaný dokument do počítača ako PDF alebo Markdown?**
  V sekcii **📚 Dokumentácia & Help** klikni na záložku **📁 Archív záznamov (MD / PDF)** a pri ľubovoľnom dokumente klikni na **`⬇ Stiahnuť .MD`** alebo **`⬇ Stiahnuť .PDF`**.
- **Ako pridám vlastný produkt alebo službu na predaj cez Revolut / PayPal?**
  Otvor **⚙ Nastavenia → 💳 Obchod a platby**, vlož svoj Revolut/PayPal odkaz a ulož ponuku. Verejný platobný odkaz `/pay/revolut-pro/<id>` alebo `/pay/paypal/<id>` môžeš ihneď poslať klientovi.
- **Ako vrátim späť vzhľad UI, ak sa mi nová téma nepáči?**
  V **⚙ Nastavenia → 🎨 Živý vzhľad & UI** klikni na tlačidlo **↺ Obnoviť predvolený vzhľad** alebo v chate napíš: *„Trinity, obnov predvolený vzhľad UI.“*

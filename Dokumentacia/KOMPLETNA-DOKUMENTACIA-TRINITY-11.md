# Kompletná Oficiálna Dokumentácia a Technická Encyklopédia TRINITY 11.0 (OMNI-CORE)

**Verzia systému:** Trinity 11.0.0 OMNI-CORE  
**Dátum vydania:** 1. novembra 2026  
**Zvrchovaný tvorca a vlastník:** Ivan Sabo (alias **Basterix**), `saboivan2008@gmail.com`  
**Produkčná zóna:** [https://auru.space](https://auru.space) (Klientsky portál & Asistent)  
**Vývojová a staging zóna:** [https://auru.dev](https://auru.dev) (Súkromný Owner Lab)  
**Kánonický repozitár:** `uscolective-byte/Trinity-antigravity` (vetva `main`)  
**Režim pravdivosti (Truth Policy):** Verzia 2.1.0 (`evidence-required`, nulové simulácie, povinné auditné receipty)  

---

## 📑 Obsah

1. [Úvod a Zvrchované Poslanie Trinity](#1-úvod-a-zvrchované-poslanie-trinity)
2. [7-Vrstvová Architektúra OMNI-CORE](#2-7-vrstvová-architektúra-omni-core)
3. [Omni-Dev Studio & Lokálny PC Bridge (Terminál, Súbory, Editor)](#3-omni-dev-studio--lokálny-pc-bridge)
4. [Meta AI & Sociálny Ekosystém (Llama 3.3/3.1/3.2, Facebook, Instagram)](#4-meta-ai--sociálny-ekosystém)
5. [Google Cloud Platform & Gemini 3.8 Flash Integrácia](#5-google-cloud-platform--gemini-38-flash-integrácia)
6. [Flotila 29 Cloudflare Workerov, Úložiská & Služby](#6-flotila-29-cloudflare-workerov-úložiská--služby)
7. [Desatoro Pravdivosti a Neporušiteľný Režim Pravdy](#7-desatoro-pravdivosti-a-neporušiteľný-režim-pravdy)
8. [Katalóg 112+ Exekučných Nástrojov a Schopností (Skill Matrix)](#8-katalóg-112-exekučných-nástrojov-a-schopností)
9. [Príručka pre Používateľa (Ako pracovať s Trinity)](#9-príručka-pre-používateľa)
10. [Licenčné Podmienky, GDPR a Bezpečnostné Vyhlásenie](#10-licenčné-podmienky-gdpr-a-bezpečnostné-vyhlásenie)

---

## 1. Úvod a Zvrchované Poslanie Trinity

**Trinity 11.0** nie je konvenčný chatbot ani pasívny jazykový model. Predstavuje **zvrchovaný, autonómny operačný a vývojársky ekosystém (Sovereign AI Agentic OS)** navrhnutý na Cloudflare Edge infraštruktúre, schopný:
- autonómne písať a refaktorovať kód,
- vykonávať obojsmerné systémové akcie priamo na hostiteľskom počítači (Windows OS) cez zabezpečený most (PC Bridge),
- generovať produkčné weby a aplikácie s okamžitým deploymentom a DNS záznamami,
- riadiť sociálne siete (Meta Facebook Pages a Instagram Business účty),
- spravovať multi-modelovú AI inferenciu (Workers AI Llama 3.3 70B, Google Gemini 3.8 Flash, OpenAI GPT-4.1-mini, Anthropic, DeepSeek R1, Groq, Mistral),
- striktne chrániť pravdivosť výstupov podľa **Desatora pravdivosti** (Truth Policy 2.1.0) bez tolerancie akýchkoľvek vymyslených dát či falošných úspechov.

### Triáda Zvrchovanej Správy
Systém je spravovaný v dokonalej súčinnosti trojice pilierov:
1. **Trinity Sovereign Core:** Autonómny orchestrátor, strážca pravidiel a rozhranie pre majiteľa.
2. **GPT / Codex:** Výkonný kódovací motor pre hĺbkové refaktoringy, transportné vrstvy a lokálne workerd verifikácie.
3. **Antigravity (Google DeepMind):** Strategický agent pre orchestráciu ekosystému, integráciu commitov, guarded rollouts a nezávislé auditné brány.

---

## 2. 7-Vrstvová Architektúra OMNI-CORE

Systém Trinity OMNI-CORE je rozdelený do 7 striktne izolovaných a auditovaných vrstiev:

```
┌────────────────────────────────────────────────────────────────────────┐
│ VRSTVA 7: ZVRCHOVANÉ ROZHRANIE (Garage UI & Omni-Dev Studio)           │
│ - Chat & Práca, AI Studio, Domény, Peňaženka, Dokumentácia, Omni-Dev   │
├────────────────────────────────────────────────────────────────────────┤
│ VRSTVA 6: KOGNÍCIA, INTELIGENCIA & PENTAD 2.0 ORCHESTRÁTOR             │
│ - Directives: Developer, Meta, Loyalty, Trading, Sovereign Triad       │
│ - Modely: Workers AI, Gemini 3.8 Flash, GPT-4.1-mini, DeepSeek R1     │
├────────────────────────────────────────────────────────────────────────┤
│ VRSTVA 5: 112+ EXEKUČNÝCH NÁSTROJOV & SÉMANTICKÝ SKILL MATRIX          │
│ - meta_manage, pc_*, domain_*, cf_*, wallet_*, calculate, etc.         │
├────────────────────────────────────────────────────────────────────────┤
│ VRSTVA 4: HOST PC BRIDGE (Ring 0 System Agent & Live Daemon)          │
│ - PowerShell, CMD, Node, Python, WinRT OCR, Screenshot, File Browser   │
├────────────────────────────────────────────────────────────────────────┤
│ VRSTVA 3: CLOUDFLARE EDGE WORKER FLEET (29 Viazaných Workerov)         │
│ - Core, Dispatcher, Builder, Connectors, Guardian, Memory, Sentinel... │
├────────────────────────────────────────────────────────────────────────┤
│ VRSTVA 2: DÁTOVÉ ÚLOŽISKÁ & MERKLE LEDGER                             │
│ - D1 trinity-v03, KV Mastermind, R2 trinity-artifacts, Durable Objects │
├────────────────────────────────────────────────────────────────────────┤
│ VRSTVA 1: KRYPTOGRAFICKÝ SOVEREIGN LOCK & TRUTHGUARD                   │
│ - Nonce Vault, Replay Protection, SHA-256 Merkle Chain, Truth Policy   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Omni-Dev Studio & Lokálny PC Bridge

**Omni-Dev Studio** (`#omnidev-view`) je vývojárske split-screen centrum zabudované priamo do Trinity.

### Komponenty Omni-Dev Studia:
1. **Ľavý panel (Chat & Pentad 2.0 Orchestrator):**
   - Interaktívny terminálový chat optimalizovaný pre vývoj a kódovanie.
   - Pentad 2.0 Router: výber medzi Auto Routerom, Edge AI (Llama 3.3 70B), Gemini 3.8 Flash, Copilot Studiom a Consensus Guardom.
   - Živý timer rozpočtu (`BUDGET: 100 000 ms`) so sledovaním jednotlivých fáz uvažovania.

2. **Pravý panel (Omni-Workspace Canvas):**
   - **💻 Live PC Terminál:** Okamžité spustenie príkazov v PowerShell, CMD, Node.js alebo Pythone s reálnym zobrazením `stdout` a `stderr`.
   - **📁 Prieskumník súborov (Host PC):** Skutočný interaktívny strom priečinkov a súborov z hostiteľského disku `C:\Users\saboi\Trinity-antigravity` s navigáciou a 1-klikom pre načítanie do editora.
   - **🧬 Code Editor s Auto-Rollbackom:** Načítanie súboru z disku, úprava kódu priamo v UI a aplikovanie zmeny cez bezpečný mechanizmus `self-modify` s automatickým R2 snapshotom pred každou mutáciou.
   - **🧰 Skill Matrix & Store:** Prehľad 112+ nástrojov s vektorovým sémantickým vyhľadávaním (`@cf/baai/bge-base-en-v1.5`).
   - **⚡ Prepojené Aplikácie & Auth:** Centrum autorizácie pre Meta (Facebook/Instagram), Google Cloud, GitHub, Cloudflare a lokálny PC Bridge.
   - **📜 Sovereign Health & Audit:** Zobrazenie stavu hostiteľského PC, pamäte, CPU, overenia súboru `PRISLUB_TRINITY.txt` a aktívnych circuit breakerov.

### Windows PC Daemon
Lokálny daemon beží na pozadí Windows a zabezpečuje spojenie:
- **Cesta skriptu:** `scripts/trinity-pc-daemon.mjs`
- **Štartovací launcher:** `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Start-Trinity-PC-Daemon.cmd`
- **DPAPI kľúč:** Šifrovaný v `Local-Gateway\.credentials\gateway-key.dpapi`.
- **Cieľ spojenia:** `https://auru.space` (interval kontroly: 4000 ms).

---

## 4. Meta AI & Sociálny Ekosystém

Trinity je plne vybavená na správu a využitie ekosystému Meta.

### Podporované Meta AI Modely (cez Cloudflare Workers AI):
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast`: Hlavný kognitívny model pre zložité uvažovanie, kódovanie a tvorbu príspevkov.
- `@cf/meta/llama-3.1-8b-instruct-fp8-fast`: Bleskový model pre rýchle odpovede s nízkou latenciou.
- `@cf/meta/llama-3.2-11b-vision-instruct`: Multimodálny vizuálny model schopný analyzovať obrázky, screenshoty a UI grafiku.

### Prepojené Účty Majiteľa:
- **Facebook Stránka:** `underground Street collective`
- **Instagram Profil:** `@old_dirty_bastard013`
- **OAuth Pripojenie:** [https://auru.space/connect/meta](https://auru.space/connect/meta)
- **Graph API:** Verzia `v26.0` s bezpečnou numerickou diagnostikou chýb (bez úniku prístupových tokenov).

### Dedikovaný Nástroj `meta_manage`:
- `action: "status"`: Stav pripojenia, zoznam platných oprávnení a zoznam AI modelov.
- `action: "connect_url"`: Vygenerovanie autorizačnej linky pre majiteľa.
- `action: "pages"`: Prehľad spravovaných stránok a profilov.
- `action: "ai_generate"`: Priama inferencia s vybraným Llama modelom.
- `action: "create_post_draft"`: Tvorba naformátovaného príspevku s platformovými hashtagmi (`#undergroundstreetcollective`, `#olddirtybastard013`).

---

## 5. Google Cloud Platform & Gemini 3.8 Flash Integrácia

- **Google Cloud Projekt:** `tangential-osprey-dl7cp`
- **Správca:** `saboivan2008@gmail.com`
- **Model:** `gemini-3.8-flash` cez oficiálne Google AI Studio API (`v1beta/interactions` a `generateContent`).
- **Aktívne API:** `generativelanguage.googleapis.com`, `aiplatform.googleapis.com`, `cloudresourcemanager.googleapis.com`, `storage.googleapis.com`, `firestore.googleapis.com`, `drive.googleapis.com`, `docs.googleapis.com`, `sheets.googleapis.com`.

---

## 6. Flotila 29 Cloudflare Workerov, Úložiská & Služby

Trinity pozostáva z **29 prepojených Workerov** na Cloudflare Edge:
1. **10× AURA Špecialisti:** `AURA_ANALYZER`, `AURA_ARCHITECT`, `AURA_CODEGEN`, `AURA_DEPLOYER`, `AURA_EVOLVER`, `AURA_MEMORY`, `AURA_OPTIMIZER`, `AURA_PLANNER`, `AURA_SENTINEL`, `AURA_TESTER` (s aliasmi `admin`, `admino`, `Trinity`).
2. **8× Trinity Core:** `CORE`, `BUILDER`, `DISPATCHER`, `CONNECTORS`, `GUARDIAN`, `MEMORY`, `SENTINEL`, `SKILLS`.
3. **8× Špecializované & RPC Služby:** `KNOWLEDGE_SERVICE`, `CAPACITY_SERVICE`, `INTEGRATIONS_SERVICE`, `PC_BRIDGE_SERVICE`, `PC_BRIDGE_V2`, `AUDIT_SERVICE`, `JERICHO_SERVICE`, `CHAT_INFERENCE_SERVICE`.
4. **3× Pomocné operačné služby:** `RESEARCHER_SERVICE`, `GEMINI_BRIDGE_SERVICE`, `DEPLOYER_SERVICE`.

### Úložiská:
- **D1 Databáza `trinity-v03` (`ca8ea24e-f7db-431e-b8bf-97f713ae4533`):** Ukladanie úloh (`ops_jobs`), krokov (`ops_steps`), pamäte (`ops_memory`), domén (`domains`), dokumentov a Merkle ledgeru (`ops_sovereign_ledger_v3`).
- **KV Namespace `Mastermind` (`0b92ed2717d742daa860f1827797297f`):** Rýchle cacheovanie stavov, kľúčov a session tokenov.
- **R2 Bucket `trinity-artifacts`:** Trvalé úložisko vygenerovaných webov, snapshotov kódu, PDF exportov a médií.
- **Workflow `trinity-operations`:** Asynchrónne riadenie a krokovanie zložitých multi-agentných úloh s retry logikou a deadlinom.

---

## 7. Desatoro Pravdivosti a Neporušiteľný Režim Pravdy

V zmysle **Desatora pravdivosti (Truth Policy 2.1.0)** a **Sovereign Root Covenant** platia tieto nezrušiteľné princípy:
1. **Zákaz halucinácií a nepodložených tvrdení:** Trinity nesmie nikdy tvrdiť, že niečo spravila, nasadila alebo zaplatila, pokiaľ na to nemá overiteľný auditný receipt.
2. **Nulové syntetické simulácie:** Tvrdenia o úspechu bez reálnej exekúcie sú prísne blokované kontrolou pravdivosti (`assertNoSimulatedData`).
3. **Fail-Closed prístup:** Ak zlyhá sieť, provider alebo autorizácia, systém otvorene prizná chybu namiesto predstierania úspechu.
4. **Guarded Rollout:** Každé nasadenie do produkcie vyžaduje plný 40-znakový commit SHA tag, prechod všetkými testami a verifikáciu cez `verify-deployment.mjs`.
5. **Jednosmerný Merkle Ledger:** Každá kritická akcia je zapísaná do kryptografického bloku (`ops_sovereign_ledger_v3`) s prepojením na predchádzajúci hash bloku.

---

## 8. Katalóg 112+ Exekučných Nástrojov a Schopností

Nástroje sú v kóde rozdelené na interné systémové nástroje (`INTERNAL_TOOLS`), PC nástroje (`PC_TOOLS`), biznis nástroje (`OWNER_BUSINESS_TOOLS`) a pluginové moduly:

- **Vývoj & Systém:** `project_inspect`, `project_read`, `improvement_submit`, `infrastructure_status`, `hosting_deploy`, `hosting_list`, `self_evolve`, `ui_evolve`, `cf_self_deploy`, `apply_self_evolution`.
- **PC Bridge:** `pc_screenshot`, `pc_run`, `pc_run_script`, `pc_file_read`, `pc_file_write`, `pc_file_append`, `pc_file_edit`, `pc_directory_create`, `pc_open_app`, `pc_app_control`, `pc_notify`, `pc_system_info`, `pc_fs_read`, `pc_fs_write`, `pc_fs_patch`, `pc_shell_exec`, `pc_system_telemetry`.
- **Meta AI & Social:** `meta_manage` (akcie: `status`, `connect_url`, `pages`, `ai_generate`, `create_post_draft`).
- **Domény & DNS:** `domain_check`, `domain_list`, `domain_inspect`, `domain_add`, `domain_register`, `domain_set_dns`, `domain_delete_dns`, `domain_list_for_sale`, `domain_sell`, `domain_list_for_lease`, `domain_lease`, `domain_end_lease`, `domain_marketplace`, `domain_env_provision`, `domain_env_deploy`, `domain_env_list`.
- **Financie & Peňaženka:** `wallet_terminals_status`, `terminal_charge`, `terminal_payout`, `wallet_create`, `commodity_analyze`, `commodity_desk`, `commodity_trade`, `commodity_auto_invest`.
- **Multimédiá & Generovanie:** `generate_image` (Flux 1 Schnell), `generate_video`, `generate_music`, `generate_presentation`, `create_file`, `create_pdf`.
- **Dáta & Web:** `web_search`, `web_fetch`, `open_weather`, `open_wikipedia`, `network_dns`, `crypto_prices`, `tech_news`, `macro_data`.

---

## 9. Príručka pre Používateľa

### Ako správne zadávať úlohy:
1. **Pre bežné otázky a tvorbu:**
   - Napíš priamo požiadavku do chatu v slovenčine (napr. *"Napíš blogový článok o kybernetickej bezpečnosti"*).
2. **Pre prácu s hostiteľským PC:**
   - Otvor **Omni-Dev Studio** (`⚡ Omni-Dev Studio` v bočnom menu) a použi Live Terminál alebo zvoľ v chate motor `Môj počítač · PC Bridge`.
3. **Pre správu sociálnych sietí Meta:**
   - Napíš: *"Trinity, zisti stav môjho Meta účtu"* alebo *"Vytvor draft príspevku pre Facebook stránku underground Street collective cez Llama 3.3"*.
4. **Pre vytvorenie nového webu či domény:**
   - Prejdi do sekcie `Domény & Hosting` alebo napíš: *"Vytvor subdoménu demo.auru.space a nasaď na ňu landing page pre náš projekt"*.
5. **Pre prístup k dokumentácii a exportom:**
   - Klikni na `≡ Dokumentácia` v ľavom paneli, kde máš k dispozícii všetky manuály a možnosť stiahnuť každý dokument v `.MD` alebo `.PDF`.

---

## 10. Licenčné Podmienky, GDPR a Bezpečnostné Vyhlásenie

- **Vlastníctvo kódu:** Výhradným iniciátorom a majiteľom systému Trinity OMNI-CORE je Ivan Sabo (Basterix).
- **Ochrana údajov (GDPR):** Systém rešpektuje Nariadenie (EÚ) 2016/679 a Zákon č. 18/2018 Z. z. Žiadne privátne kľúče ani prihlasovacie heslá do tretích strán sa neukladajú v nezašifrovanej podobe.
- **Trezor tajomstiev:** Citlivé tokeny sú šifrované cez AES-GCM 256-bit alebo chránené v Cloudflare Secrets Store / Windows DPAPI.

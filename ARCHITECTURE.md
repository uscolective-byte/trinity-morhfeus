# TRINITY OMNI-CORE — 7-LAYER ARCHITECTURE & 35 EXECUTION EPICS

**Systém:** TRINITY OMNI-CORE (`v11.0.0`)  
**Výlučný Vlastník & Hlavný Architekt (Ring 0 Root Authority):** Basterix (Sabo Ivan)  
**Domény:** `https://auru.space` (Production) · `https://auru.dev` (Staging / OmniDev)  
**Lokálny Systémový Most:** `http://127.0.0.1:7788` (`system-bridge.js`) & `http://127.0.0.1:8791` (`Local-Gateway`)

---

## Prehľad 7 Systémových Vrstiev (35 Exekučných Epikov)

```
┌─────────────────────────────────────────────────────────────────┐
│               LAYER 7: EVOLUTION (Epiky 31 - 35)                │
├─────────────────────────────────────────────────────────────────┤
│               LAYER 6: SECURITY (Epiky 26 - 30)                 │
├─────────────────────────────────────────────────────────────────┤
│               LAYER 5: EXECUTION (Epiky 20 - 25)                │
├─────────────────────────────────────────────────────────────────┤
│               LAYER 4: SOVEREIGN LEDGER (Epiky 14 - 19)         │
├─────────────────────────────────────────────────────────────────┤
│               LAYER 3: MEMORY ENGINE (Epiky 9 - 13)             │
├─────────────────────────────────────────────────────────────────┤
│               LAYER 2: ORCHESTRATION (Epiky 5 - 8)              │
├─────────────────────────────────────────────────────────────────┤
│               LAYER 1: SOVEREIGN KERNEL (Epiky 1 - 4)           │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 1: Sovereign Kernel (Epiky 1 – 4)
- **EP-01:** Deterministický plánovač úloh a prioritná fronta (`ComputeBudgetManager`).
- **EP-02:** Správa kontextového okna a pridelovanie výpočtového rozpočtu.
- **EP-03:** Kernel prerušenia (Interrupt Handler) a núdzový Kill-Switch (`< 100 ms`).
- **EP-04:** Jednotný stavový automat životného cyklu (`ExecutionLifecycleGuard`: `PROPOSED -> RUNNING -> COMPLETED -> VERIFIED / FAILED`).

### Layer 2: Multi-Agent Orchestration (Epiky 5 – 8)
- **EP-05:** 4-uzlový TMAC konsenzus (`TMACConsensusEngine`: Planner, Builder, Auditor, Sentinel s právom veta).
- **EP-06:** Koordinácia 29 naviazaných Cloudflare Workerov (10× AURA špecialistov, 8× Trinity Core, 8× RPC služieb + 3 aliasy).
- **EP-07:** Sémantické smerovanie nástrojov (`skill-matrix.js` + `@cf/baai/bge-base-en-v1.5`).
- **EP-08:** Omnichannel brána s izoláciou externých správ (`OmnichannelGateway`).

### Layer 3: 4-Tier Memory Engine (Epiky 9 – 13)
- **EP-09:** Krátkodobá pracovná pamäť (STM) a kontextová cache v Cloudflare KV (`Mastermind`, `PC_STATE`).
- **EP-10:** Dlhodobá sémantická pamäť (LTM) v Cloudflare D1 (`ops_memory`, `memory_long`).
- **EP-11:** Epizodická pamäť a vektorové vyhľadávanie.
- **EP-12:** Firecrawl RAG extrakcia webového obsahu do čistého Markdownu (`firecrawl_scrape`).
- **EP-13:** Firebase Firestore real-time zrkadlenie stavu (`firebase_manage` + `ops_firebase_mirror`).

### Layer 4: Sovereign Ledger v3 & Truth Engine (Epiky 14 – 19)
- **EP-14:** Kryptograficky reťazený `SovereignLedgerV3` (`SHA-256` bloky v D1 tabuľke `ops_sovereign_ledger_v3` s `BEFORE UPDATE/DELETE` triggermi proti prepisu).
- **EP-15:** Protokol absolútnej pravdivosti (`SovereignTruthGuard` – 10 prikázaní pravdivosti / Desatoro Pravdivosti).
- **EP-16:** Sledovanie pôvodu kódu (`CodeProvenanceTracker` – `ops_code_provenance`).
- **EP-17:** Deterministická obnova a prehratie stavu (`StateReplayEngine` – `ops_state_replay`).
- **EP-18:** Fyzické overenie zápisu na disk a kontrola `exitCode === 0`.
- **EP-19:** Anti-Assumption filter blokujúci nepodložené tvrdenia.

### Layer 5: Sandboxed Execution & Local Bridge (Epiky 20 – 25)
- **EP-20:** Lokálny systémový most na porte `7788` (`system-bridge.js` / `Local-Gateway/src/system-bridge.mjs`).
- **EP-21:** Lokálna brána návrhov na porte `8791` (`Local-Gateway/src/server.mjs`).
- **EP-22:** Bezpečné spúšťanie skriptov s kontrolou `SHA-256` odtlačku (`script-command.mjs`).
- **EP-23:** Ovládanie povolených desktopových aplikácií s auditným záznamom (`desktop.mjs`).
- **EP-24:** OmniDev Studio generátor a AST diagnostika (`studio.js` + `omnidev-diagnostics.js`).
- **EP-25:** Správa artefaktov a PDF dokumentov v R2 (`trinity-artifacts`).

### Layer 6: Zero-Trust Security & Ring 0 Sovereign Lock (Epiky 26 – 30)
- **EP-26:** Zjednotené autorizačné jadro (`trinity-auth-core.js` / `trinity-auth-core.mjs`) – fail-closed overenie skutočného Windows SID (`/^S-1-5-21-\d+-\d+-\d+-\d+$/`) zo systémového tokenu `WindowsIdentity::GetCurrent()`, overeného Google OAuth tokenu (`verifiedGoogleToken: true`) a HMAC overeného Telecom kanála (`verifiedWebhookSignature: true`).
- **EP-27:** Ring 0 Sovereign Lock (`sovereign-lock.js`) – zákaz autonómneho prepisu kódu bez podpísaného `Consentelope` od Basterixa.
- **EP-28:** Trvalé atomické úložisko spotrebovaných nonce (`ops_consumed_nonces` v D1 + KV + lokálny Disk Vault) proti Replay útokom aj po reštarte procesu.
- **EP-29:** Data-Command Boundary – všetky externé správy (WhatsApp, Facebook, Instagram, web, e-mail) sú striktne `PASSIVE_DATA`.
- **EP-30:** Path Traversal Guard a DACL Read-Only ochrana kritických súborov jadra (`PROTECTED_RING0_FILES`).

### Layer 7: Governed Self-Evolution (Epiky 31 – 35)
- **EP-31:** Návrhy vylepšení kódu viazané na Git diff a manuálne schválenie Basterixa (`self-improvement.js`).
- **EP-32:** Diagnostika a oprava chýb v OmniDev Studio (`proposeOmniDevRecoveryPatch`).
- **EP-33:** Dynamické prispôsobenie používateľského rozhrania (`ui-evolution.js`).
- **EP-34:** Automatická synchronizácia verzie a dokumentácie (`sync-release-docs.mjs`).
- **EP-35:** Kryptografická verifikácia nasadenia (`verify-deployment.mjs`).

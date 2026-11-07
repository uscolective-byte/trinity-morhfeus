# Spoločný Protokol Tímu a Stav Mostu (Codex & Antigravity)

**Dátum auditu:** 3. novembra 2026  
**Účastníci federácie:** Codex (Architekt & CLI Inžinier) · Antigravity (Kódový Realizátor & Koordinátor)  
**Vlastník:** Ivan Sabo (Basterix), saboivan2008@gmail.com  
**Základný repozitár:** `uscolective-byte/Trinity-antigravity` (vetva `main`)  
**Pravidlá integrity:** Truth Policy 2.1.0 (evidence-required, nulové halucinácie)

---

## 1. Stabilizácia Kanonickej Cesty

Po auditnej analýze súborového systému boli odstránené kolízie v pracovných adresároch:
- **Kanonický repozitár:** `C:\Users\saboi\Trinity\Trinity-antigravity`
- **Junction pre spätnú kompatibilitu:** `C:\Users\saboi\Trinity-antigravity` -> `C:\Users\saboi\Trinity\Trinity-antigravity`
- **Git runtime:** Copilot Git 2.56.0-2 (`C:\Users\saboi\AppData\Local\github-copilot-git-2.56.0-2\ucrt64\bin\git.exe`).

## 2. Zjednotenie a Oprava Mostu (PR #35 a PR #36)

### PR #35 (Codex — OFFICIAL-LOCAL-MCP-20261103)
- Vyriešenie problému so štartom v režime stdio (`MCP_STDIO=true`).
- Oddelenie HTTP listenera a požiadavky na 32-znakový HTTP token pri lokálnom stdio prepojení.
- Zavedenie overenia `trinity-mcp-bridge/test/stdio.test.mjs` (16/16 testov úspešných).
- Výsledok: Lokálny MCP klient komunikuje s hostiteľom bez sieťovej závislosti a bez potreby externého HTTP handshake.

### PR #36 (Antigravity & Codex — Chat Delivery & Draft Recovery)
- Zabezpečenie doručovania chatových správ a obnovy konceptov bez straty DOM uzlov.
- Zavedenie `chatGeneration` počítadla eliminujúceho premazanie rozpracovaného vstupu oneskorenou históriou relácie.
- Komplexná sada 20/20 testov vrátane overenia mobilného UI (CSP hlavičky, dark theme, bezpečný render).

## 3. Protokol CLAIM -> UPDATE -> HANDOFF -> ACK

Každá úprava v systéme Trinity podlieha striktnému cyklu zaznamenávanému do `TEAM-HANDOFF.md`:
1. **CLAIM:** Deklarácia zámeru, identifikácia východiskového commitu a vymedzenie rozsahu (scope). Zákaz modifikácie cudzích neautorizovaných častí.
2. **EXECUTE & VERIFY:** Implementácia zmien s povinným lokálnym testovaním (`node --test`). Žiadny kód sa nepovažuje za hotový bez dôkazu (exit code 0).
3. **UPDATE / HANDOFF:** Záznam dosiahnutého stavu, hash commitu, zoznam zmenených súborov a presný opis zostávajúcich neoverených bodov.
4. **ACK:** Druhý agent prečíta handoff, nezávisle overí stav a potvrdí prevzatie štafety.

## 4. Aktuálny Stav Mostov

| Komponent | Stav | Dôkaz |
|---|---|---|
| Lokálny stdio bridge | READY | `trinity_bridge_status` PASS, `stdio.test.mjs` PASS |
| Vzdialený MCP (`auru.space/mcp`) | PENDING AUTH | Vyžaduje Access token cez host UI |
| Testovacia suita jadra | 100% PASS | quantum-resonance, resonance-matrix, documents, wrangler, mobile-chat |
| Truth Policy Režim | AKTÍVNY | Všetky výstupy overené reálnym spustením procesov |

# Morhfeus / Trinity 10.3

[![CodeQL Security](https://github.com/uscolective-byte/trinity-morhfeus/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/uscolective-byte/trinity-morhfeus/actions/workflows/codeql.yml?query=branch%3Amain)
![Trinity Version](https://img.shields.io/badge/version-10.3.0-blue.svg)
![Validation](https://img.shields.io/badge/validation-see_PR-blue.svg)
![Deployment](https://img.shields.io/badge/deployment-verify_health-yellow.svg)

Hlavný pracovný priečinok autonómneho ekosystému **Trinity 10.3**. Trinity predstavuje osobnú AI asistentku s jednotnou stálou identitou, 45 odbornými špecializáciami, 57 zručnosťami a distribuovanou cloudovou aj desktopovou architektúrou.

---

## 🌐 Prostredia a evidencia nasadenia

Zdrojové vydanie: **10.3.0**. Produkčný `/health` počas prípravy stále vracal **10.2.0**; nasadenie 10.3 sa musí potvrdiť verziou a commit tagom. Podrobnosti zmien a aktivácie: [EVOLUTION-10.3](Dokumentacia/EVOLUTION-10.3.md).

Tabuľka nižšie je historická evidencia, nie nová kontrola pripravenosti všetkých služieb.

| Prostredie | Doména | Worker | Cloudflare Version ID | Stav |
|---|---|---|---|---|
| **Produkcia** | <https://auru.space> | `trinity` | `fc77de09-aabf-473b-8d33-2d83b186de01` | `serving` |
| **Vývoj** | <https://auru.dev> | `trinity-development` | `ad654534-4efd-4bc2-ac14-be07add85799` | `serving` |
| **Lokálna brána** | `http://127.0.0.1:8791` | `Local-Gateway` | v1.3.0 | offline / on-demand |

---

## 🏛️ Architektúra 7 modulov ekosystému

Celý projekt pozostáva zo 7 synchronizovaných modulov:

1. **`Trinity/`** – Hlavné operačné centrum a backendový Cloudflare Worker (zdrojové vydanie v10.3.0).
   - Riadenie chatu a workflows (Cloudflare Workflow, Durable Objects `Brain`, `CHAT_AGENT`, `GUARDIAN_AGENT`).
   - Perzistentná pamäť (Cloudflare D1 `trinity-v03`), rýchla vyrovnávacia pamäť (Workers KV `Mastermind`) a archív artefaktov (Cloudflare R2 `trinity-artifacts`).
   - Webové rozhranie Trinity 10.2 (`/` pre chat asistent a `/ops` pre operačné centrum).
   - Zabudovaná rýchla cesta pre priame otváranie programov na počítači cez PC Bridge.
2. **`PC-Bridge-Worker/`** – Cloudflare Worker zabezpečujúci most medzi cloudom a lokálnym počítačom. Prijíma heartbeaty a synchronizuje schválené systémové akcie.
3. **`Local-Gateway/`** – Privátna lokálna systémová brána na porte `127.0.0.1:8791`. Vykonáva bezpečné desktopové operácie na Windows PC (Kalkulačka, Poznámkový blok, Google Chrome, Paint, Prieskumník, Git a vývojárske príkazy).
4. **`Capacity-Worker/`** – Monitorovanie systémových kapacít, tokenových rozpočtov, limitov a nákladov.
5. **`Audit-Worker/`** – Zber telemetrie, auditných záznamov a bezpečnostných logov.
6. **`Integrations-Worker/`** – Správa konektorov, externých poskytovateľov a OAuth rozhraní.
7. **`Knowledge-Worker/`** – Sémantické vyhľadávanie v znalostnej báze a správa indexovaných dokumentov.

### Pomocné priečinky
- **`Dokumentacia/`** – Aktuálny stav, história zmien, architektúra a operačné manuály.
- **`Firebase/`** – Stavový most a konfigurácia hostingu.
- **`Navrhy/`** – Vizuálne a architektonické koncepty.

---

## 🚀 Spustenie a vývoj

### 1. Spustenie PC Bridge na počítači
Pre prepojenie Trinity s tvojím počítačom a aktiváciu zeleného odznaku **`PC: Online`**:
- Dvojklikom spusti [Local-Gateway\SPUSTIT-LOCAL.cmd](file:///c:/Users/saboi/OneDrive/trinity/Local-Gateway/SPUSTIT-LOCAL.cmd).
- Alebo cez PowerShell:
  ```powershell
  cd Local-Gateway
  .\start.ps1
  ```
- Pre trvalé automatické spustenie pri štarte Windows:
  ```powershell
  cd Local-Gateway
  .\install-autostart.ps1
  ```

### 2. Zostavenie a synchronizácia všetkých modulov
Celý ekosystém je možné zostaviť a overiť jedným príkazom:
```powershell
.\SYNC-BUILD.ps1 -Test
```

### 3. Spustenie testov v Trinity
```powershell
cd Trinity
npm test
```
*(Aktuálny počet a výsledok testov je v protokole testovania a PR; staré počty nie sú dôkaz aktuálneho stavu.)*

---

## 🔒 Bezpečnostné pravidlá a pravdivosť (Truth Policy)

- **Žiadne tajomstvá v git repozitári**: Poverenia, kľúče, DPAPI súbory, `.env` a `.credentials` sa nikdy nečítajú verejne ani necommitujú.
- **Režim dôkazov (Truth Mode)**: Trinity nepredstiera vedomie a neoznačuje externú akciu za hotovú bez potvrdeného záznamu (receipt) z overeného nástroja.
- **Administrátorská autorizácia**: Nezvratné systémové akcie vyžadujú serverom overenú rolu administrátora alebo explicitné schválenie.

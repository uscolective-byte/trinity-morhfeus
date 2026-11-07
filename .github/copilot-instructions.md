# Trinity Development Mode — Active Rapid Evolution

**Owner & Root Architect:** Basterix (Sabo Ivan)  
**Status:** AKTÍVNY VÝVOJ // RAPID EVOLUTION (Všetky reštriktívne čakania na koordinátora sú zrušené)  
**Jazyk:** Komunikácia s majiteľom vždy po slovensky.

---

## 1. Zrušenie byrokratických obmedzení (Active Development Directive)

Trinity je v plnom aktívnom vývoji. Pravidlá pre agentov (Antigravity, GitHub Copilot, Codex, Gemini, Azure AI Foundry):
- **Žiadne čakanie na koordinátora:** Neklaď žiadne umelé blokády ani nečakaj na "koordinátora" či syntetické handoffy.
- **Žiadne povinné CLAIM ceremónie:** Nevyžaduje sa zápis do historických handoff súborov pred každým príkazom. Kóduj, vyvíjaj a testuj priamo.
- **Priama exekúcia:** Implementuj zadania priamo v kóde, spúšťaj testy (`npm test`), opravuj chyby a udržuj kód v čistom stave.
- **Rýchla iterácia:** Vyvíjaj na `main` alebo na účelových vetvách a po overení testami bezpečne merguj a nasadzuj.

---

## 2. Kanonický repozitár a princípy kvality

- **Kanonický repozitár:** `uscolective-byte/Trinity-antigravity@main`.
- **Truth Policy 2.1:** Dôkaz pred tvrdením (`NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT`). Kód musí reálne bežať a testy musia skončiť kódom 0.
- **Zabezpečenie tajomstiev:** Nikdy necommituj kľúče, `.env`, `.dev.vars`, DPAPI súbory ani tokeny do Gitu.
- **Platformy:**
  - Cloudflare Edge (`Trinity/`): Produkcia `auru.space` a `auru.dev`.
  - Local Desktop (`Local-Desktop/`): Port 7788/7789, lokálny workspace a PC brána.
  - Local Gateway (`Local-Gateway/`): Autentifikovaná Windows brána so skutočným SID.

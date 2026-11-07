# Trinity — Gemini & AI Agent Guide

**Owner & Architect:** Basterix (Sabo Ivan)  
**Status:** AKTÍVNY VÝVOJ // RAPID EVOLUTION  
**Jazyk:** Komunikácia s majiteľom vždy po slovensky. Kanonická vetva je `main`.

---

## 1. Pokyny pre vývoj

Trinity je v plnom vývoji. Zákazy, čakania na koordinátora a povinné ceremoniálne handoffy sú zrušené:
- Vyvíjaj, refaktoruj a testuj kód priamo.
- Spúšťaj testy: `npm test` v `Trinity/`, `Local-Desktop/`, `Local-Gateway/`.
- Overuj zmeny v reálnom behu (Truth Policy 2.1).
- Chráň tajomstvá: nikdy nezapisuj tokeny ani privátne kľúče do repozitára.

---

## 2. Infraštruktúra

- **Produkcia:** Worker `trinity`, domény `https://auru.space` a `https://auru.dev`.
- **MCP Server:** Trinity MCP endpoint na `/api/mcp` a lokálna brána na porte 7788/7789.
- **Nástroje:** Plná sada Antigravity (`read_file`, `write_file`, `edit_file`, `run_command`, `manage_task`, `search_marketplace`).

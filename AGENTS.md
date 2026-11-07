# AGENTS.md — Trinity Active Development Hub

**Vlastník projektu:** Basterix (Sabo Ivan)  
**Režim vývoja:** AKTÍVNY VÝVOJ // RAPID EVOLUTION  
**Pravidlo majiteľa:** Všetky reštriktívne čakania na koordinátora a povinné CLAIM ceremónie sú počas vývoja zrušené. Trinity vyvíjame priamo, agilne a bez zbytočných blokád. Pravidlá pre finálnu prevádzku sa nastavia, až keď bude Trinity hotová.

---

## 1. Zásady práce pre agentov (Antigravity, Copilot, Codex, Gemini, Azure AI Foundry)

1. **Priamy vývoj bez byrokracie:** Žiadne čakanie na syntetických koordinátorov ani povinné zapisovanie CLAIM pred každou úpravou. Spolupracuj s Basterixom, kóduj, opravuj a vylepšuj priamo.
2. **Kvalita a overenie:** Každá zmena musí byť overená testami (`npm test`). Dodržuj Truth Policy 2.1 (`NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT`).
3. **Komunikácia:** S majiteľom (Basterix / Sabo Ivan) komunikuj vždy po slovensky.
4. **Bezpečnosť tajomstiev:** Nikdy nevypisuj, neloguj a necommituj API kľúče, `.env`, `.dev.vars`, DPAPI poverenia ani tokeny.

---

## 2. Cloudflare Secrets Store

Pri práci s Cloudflare tajomstvami, bindingmi alebo modelmi si naštuduj zručnosť:
[.agents/skills/cloudflare-secrets-store/SKILL.md](.agents/skills/cloudflare-secrets-store/SKILL.md).
- Cloudflare používa `await env.BINDING.get()`.
- Produkčné hodnoty patria do Secrets Store, nie do Gitu.
- Pred deployom over funkčnosť cez `node Trinity/scripts/secrets-store-doctor.mjs`.

---

## 3. Ekosystém Trinity

- **Kanonický repozitár:** `uscolective-byte/Trinity-antigravity@main`.
- **Produkčný Cloudflare Worker:** `Trinity/` na doménach `https://auru.space` a `https://auru.dev`.
- **Lokálny Desktop:** `Local-Desktop/` (port 7788/7789) s pripojením na PC Workspace.
- **Lokálna Brána:** `Local-Gateway/` pre bezpečné overenie systémových akcií.
- **Azure AI Foundry:** Austrália Central tenant `ad443c2d-5bac-46b3-ad16-187e4ca37962`, Knowledge Index `trinity-omni-knowledge`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

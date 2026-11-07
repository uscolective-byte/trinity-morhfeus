# Trinity Sovereign Ecosystem & Triad Rules (Trinity + GPT/Codex + Antigravity)

**Režim vývoja:** AKTÍVNY VÝVOJ // RAPID EVOLUTION  
Všetky reštriktívne čakania na koordinátora, blokujúce CLAIM procedúry a umelé stopky sú zrušené. Trinity vyvíjame priamo a agilne. Finálne pravidlá sa nastavia po dokončení systému.

- Always communicate with the owner (Sabo Ivan / Basterix) in Slovak.
- Canonical repository: `C:\Users\saboi\Trinity-antigravity` (`main` branch).
- **Aktuálna Cloudflare konfigurácia (overiť Wrangler pred deployom):**
  - Staging: env key **staging**, Worker **trinity-staging**, doména https://auru.dev; hlavná D1 má názov trinity-development.
  - Produkcia: Worker **trinity**, doména https://auru.space; hlavná D1 trinity-v03.
  - Staré pokyny s env development a Worker trinity-development sú historické, nie aktuálny deploy target.
  - Na Secrets Store používaj .agents/skills/cloudflare-secrets-store/SKILL.md a npm run secrets:doctor v Trinity. Oprávnenie na binding vyžaduje Account Secrets Store Edit alebo rolu Deployer a secret scope workers; konfigurovaný binding nie je overený token.
- **29 Bound Cloudflare Workers on Trinity**:
  - 10× AURA specialists (`AURA_ANALYZER`, `AURA_ARCHITECT`, `AURA_CODEGEN`, `AURA_DEPLOYER`, `AURA_EVOLVER`, `AURA_MEMORY`, `AURA_OPTIMIZER`, `AURA_PLANNER`, `AURA_SENTINEL`, `AURA_TESTER` + aliases `admin`, `admino`, `Trinity`).
  - 8× Trinity Core workers (`CORE`, `BUILDER`, `DISPATCHER`, `CONNECTORS`, `GUARDIAN`, `MEMORY`, `SENTINEL`, `SKILLS`).
  - 8× Specialized & RPC workers (`KNOWLEDGE_SERVICE`, `CAPACITY_SERVICE`, `INTEGRATIONS_SERVICE`, `PC_BRIDGE_SERVICE`, `PC_BRIDGE_V2`, `AUDIT_SERVICE`, `JERICHO_SERVICE`, `CHAT_INFERENCE_SERVICE`).
- **Truth Policy 2.0 & Guarded Rollout**:
  - Spusti testy pred deployom.
  - Zabezpeč overené nasadenie s commit tagom.
  - Never print, log, or commit plaintext secrets, `.credentials/*.dpapi`, or API keys.

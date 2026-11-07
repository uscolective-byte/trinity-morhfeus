# Trinity Sovereign Ecosystem & Triad Rules (Trinity + GPT/Codex + Antigravity)

**Režim vývoja:** AKTÍVNY VÝVOJ // RAPID EVOLUTION  
Všetky reštriktívne čakania na koordinátora, blokujúce CLAIM procedúry a umelé stopky sú zrušené. Trinity vyvíjame priamo a agilne. Finálne pravidlá sa nastavia po dokončení systému.

- Always communicate with the owner (Sabo Ivan / Basterix) in Slovak.
- Canonical repository: `C:\Users\saboi\Trinity-antigravity` (`main` branch).
- **Unified Sovereign Core (`trinity`)**:
  - One unified Cloudflare Worker `trinity` serves both `https://auru.space` and `https://auru.dev` (the separate `trinity-development` Worker has been merged into `trinity`).
  - Shared Production Storage: D1 `trinity-v03` (`ca8ea24e-f7db-431e-b8bf-97f713ae4533`), KV `Mastermind` (`0b92ed2717d742daa860f1827797297f`), R2 `trinity-artifacts`, Workflow `trinity-operations`.
- **29 Bound Cloudflare Workers on Trinity**:
  - 10× AURA specialists (`AURA_ANALYZER`, `AURA_ARCHITECT`, `AURA_CODEGEN`, `AURA_DEPLOYER`, `AURA_EVOLVER`, `AURA_MEMORY`, `AURA_OPTIMIZER`, `AURA_PLANNER`, `AURA_SENTINEL`, `AURA_TESTER` + aliases `admin`, `admino`, `Trinity`).
  - 8× Trinity Core workers (`CORE`, `BUILDER`, `DISPATCHER`, `CONNECTORS`, `GUARDIAN`, `MEMORY`, `SENTINEL`, `SKILLS`).
  - 8× Specialized & RPC workers (`KNOWLEDGE_SERVICE`, `CAPACITY_SERVICE`, `INTEGRATIONS_SERVICE`, `PC_BRIDGE_SERVICE`, `PC_BRIDGE_V2`, `AUDIT_SERVICE`, `JERICHO_SERVICE`, `CHAT_INFERENCE_SERVICE`).
- **Truth Policy 2.0 & Guarded Rollout**:
  - Run tests before deploying.
  - Deploy unified `trinity` with `--tag <git-sha>` and verify both `https://auru.dev` and `https://auru.space` with `node Trinity/scripts/verify-deployment.mjs`.
  - Never print, log, or commit plaintext secrets, `.credentials/*.dpapi`, or API keys.

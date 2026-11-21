# Trinity v7.0.0 — Upgrade Summary

## Čo bolo urobené (9. november 2026)

### Fáza 1: Statické assets → Cloudflare CDN ✅
- `wrangler.jsonc` s `[assets]` konfiguráciou (binding: ASSETS)
- `public/` adresár: index.html, style.css, app.js, auth-bootstrap.js
- Worker deleguje statický obsah na `env.ASSETS.fetch(request)` — 0 ms CPU
- **Úspora: ~3-5 MB z bundla**

### Fáza 2: Odstránenie ťažkých závislostí ✅
- `src/lib/contracts.js` — lightweight validácia namiesto Zod (~60KB+ úspora)
- Natívne Web Standards (WebCrypto, Streams API) namiesto polyfillov
- Natívny `fetch` + `ReadableStream` namiesto HTTP klient knižníc
- **Úspora: ~2-4 MB polyfill kódu**

### Fáza 3: Modularizácia ✅
- `src/lib/router.js` — ultrarýchly URL pattern matcher
- `src/lib/d1.js` — D1 helpery s parametrizovanými dotazmi
- `src/lib/contracts.js` — lightweight validácia (nahrada Zod)
- `src/lib/stream-guard.js` — sliding-window SSE filter pre leaky
- `src/services/dispatcher.js` — klient pre Service Bindingy
- `src/worker-v7.js` — refaktorovaný entry point (338 riadkov)
- **Cieľ: < 650 KB po esbuild minify**

### Fáza 4: PowerShell Deploy ✅
- `deploy-v7.ps1` — Windows PowerShell skript
- `deploy-v7.sh` — Bash alternatíva
- Zero Local Footprint: `npx --yes` bez trvalých node_modules
- Syntax check → esbuild bundle → wrangler deploy → cleanup dist/

## Nové API endpointy

| Endpoint | Metóda | Popis |
|---|---|---|
| `/api/chat` | POST | Chat s fallback kaskádou a D1 prompty |
| `/api/tools` | GET | Zoznam 57 nástrojov |
| `/api/tools/execute` | POST | Vykonanie nástroja cez service binding |
| `/api/tools/receipts` | GET | Zoznam tool receipts |
| `/api/health` | GET | Základný health check |
| `/api/health/models` | GET | Model health + routes |
| `/api/traces` | GET | Trace logy |
| `/api/conversations` | GET/POST | Konverzácie |
| `/api/conversations/:id/messages` | GET/POST | Správy |
| `/api/projects` | GET/POST | Projekty |
| `/api/tasks` | GET/POST | Úlohy |
| `/api/settings` | GET/PUT | Nastavenia |

## D1 tabuľky (nové)

| Tabuľka | Účel |
|---|---|
| `trinity_trace_log` | Štruktúrované logy s trace_id |
| `trinity_log_config` | Nastavenia logovania |
| `trinity_tool_registry` | Register 57 nástrojov |
| `trinity_model_health` | Health checky modelov |

## Workery (nasadené)

| Worker | Účel | Cron |
|---|---|---|
| `trinity-health` | Model health check + logovanie | */15 * * * * |
| `trinity-tools` | Tool execution cez service bindingy | — |

## Deploy

```powershell
# Windows
.\deploy-v7.ps1

# Staging
.\deploy-v7.ps1 -Env staging

# Dry run
.\deploy-v7.ps1 -DryRun
```

```bash
# Linux/Mac
chmod +x deploy-v7.sh
./deploy-v7.sh
```

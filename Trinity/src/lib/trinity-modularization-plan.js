/**
 * Trinity Modularization Plan
 * 
 * Návrh na rozdelenie 13MB minifikovaného bundla do modulov.
 * Statické assets → Cloudflare Assets / R2.
 * 
 * @version 1.0.0
 * @author Trinity Team
 */

// ============================================================
// SÚČASNÝ STAV
// ============================================================
//
// Worker trinity obsahuje v jednom bundli:
//   - worker.js (server-side logika, ~10MB minified)
//   - index.html (chat UI, ~50KB)
//   - control.html (control panel, ~30KB)
//   - app.js (klient logika, ~2MB minified s Zod)
//   - auth-bootstrap.js (~20KB)
//   - style.css (~100KB)
//
// Celkom: ~13MB — na hranici Cloudflare limitov (1MB compressed)
//
// ============================================================
// CIEĽ: Rozdeliť na moduly a statické assets
// ============================================================

// --- KROK 1: Statické frontend assets → Cloudflare Assets ---

/**
 * wrangler.toml konfigurácia pre statické assets:
 * 
 * [assets]
 * directory = "./public"
 * binding = "ASSETS"
 * 
 * Štruktúra:
 * public/
 *   index.html        → chat UI
 *   control.html      → control panel
 *   app.js            → klient logika (rozdeliť ďalej)
 *   auth-bootstrap.js → auth
 *   style.css         → štýly
 *   /js/
 *     chat.js         → chat logika z app.js
 *     ui.js           → UI manipulácia
 *     stream.js       → SSE/streaming handler
 *     api.js          → fetch wrapper s trace propagation
 *     i18n.js         → slovenčina/angličtina
 *   /css/
 *     main.css
 *     themes.css
 * 
 * Worker potom servuje statické cez:
 *   return env.ASSETS.fetch(request)
 * alebo cez R2:
 *   return env.R2.get(path)
 */

// --- KROK 2: Worker moduly ---

/**
 * src/
 *   worker.js              → entry point, routing, middleware
 *   /lib/
 *     trinity-logger.js    → ✅ vytvorené
 *     trinity-tool-executor.js → ✅ vytvorené
 *     trinity-model-validator.js → ✅ vytvorené
 *     trinity-router.js    → request routing
 *     trinity-auth.js      → autentifikácia
 *     trinity-session.js   → session management
 *   /agents/
 *     chat-agent.js        → ChatAgent Durable Object
 *     orchestrator.js      → Orchestrator logika
 *     dispatcher.js        → Dispatch engine
 *   /services/
 *     chat-inference.js    → AI inference service
 *     connectors.js        → Externé integrácie
 *     pc-bridge.js         → PC bridge
 *     memory.js            → Memory service
 *     audit.js             → Audit service
 *     guardian.js          → Security
 *   /api/
 *     chat.js              → /api/chat endpoints
 *     tools.js             → /api/tools endpoints
 *     agents.js            → /api/agents endpoints
 *     health.js            → /api/health endpoints
 *     admin.js             → /api/admin endpoints
 */

// --- KROK 3: Importy ---

/**
 * Súčasný bundle obsahuje inline:
 *   - Zod (~200KB minified) → presunúť do app.js alebo nahradiť ľahším validátorom
 *   - Crypto polyfills → odstrániť (nodejs_compat flag to rieši)
 *   - Inline HTML/CSS → vyčleniť do Assets
 * 
 * Po rozdelení by mal worker.js byť < 500KB
 * a app.js < 1MB (bez Zod, s dynamic import).
 */

// --- KROK 4: Dynamic imports pre AURA agentov ---

/**
 * AURA agenti sa načítavajú len keď sú potrební:
 * 
 *   const agent = await import(`./agents/${agentType}.js`);
 *   const result = await agent.handle(input);
 * 
 * Namiesto aby všetci agenti boli v jednom bundli.
 */

// --- KROK 5: R2 pre ťažké dáta ---

/**
 * Ťažké JSON schemy, veľké konfigurácie a template dáta
 * presunúť do R2:
 * 
 *   env.R2.get('schemas/agent-config.json')
 *   env.R2.get('templates/chat-prompt.txt')
 */

// ============================================================
// MIGRAČNÝ PLÁN
// ============================================================

export const MIGRATION_PLAN = {
  phase1: {
    name: "Statické assets do Cloudflare Assets",
    priority: "critical",
    effort: "2-3 hodiny",
    steps: [
      "Vytvoriť ./public adresár",
      "Extrahovať index.html, control.html, style.css z bundla",
      "Rozdeliť app.js na moduly (chat.js, ui.js, stream.js, api.js)",
      "Pridať [assets] do wrangler.toml",
      "Worker servuje statické cez env.ASSETS.fetch()",
      "Overiť že UI funguje"
    ],
    expectedReduction: "~3MB z bundla"
  },
  phase2: {
    name: "Worker modulárna štruktúra",
    priority: "high",
    effort: "1-2 dni",
    steps: [
      "Vytvoriť src/lib/ s logger, executor, validator (hotové)",
      "Extrahovať routing do trinity-router.js",
      "Extrahovať auth do trinity-auth.js",
      "Rozdeliť ChatAgent DO do samostatného súboru",
      "Rozdeliť service binding logiku do src/services/",
      "Dynamic imports pre AURA agentov"
    ],
    expectedReduction: "~8MB z bundla"
  },
  phase3: {
    name: "Optimalizácia importov",
    priority: "medium",
    effort: "4-6 hodín",
    steps: [
      "Nahradiť Zod ľahším validátorom alebo dynamic import",
      "Odstrániť nepoužívané polyfills",
      "Presunúť ťažké schemy do R2",
      "Tree-shaking nepoužitého kódu"
    ],
    expectedReduction: "~2MB z bundla"
  },
  phase4: {
    name: "CI/CD a testing",
    priority: "low",
    effort: "1 deň",
    steps: [
      "GitHub Actions pre deploy",
      "Unit testy pre lib moduly",
      "Integration testy pre API endpointy",
      "Health check cron job"
    ]
  }
};

// ============================================================
// wrangler.toml návrh
// ============================================================

export const WRANGLER_CONFIG = `
name = "trinity"
main = "src/worker.js"
compatibility_date = "2026-10-11"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./public"
binding = "ASSETS"

# Durable Objects
[[durable_objects.bindings]]
name = "CHAT_AGENT"
class_name = "ChatAgent"

# Service Bindings (24)
[[services]]
binding = "CHAT_INFERENCE_SERVICE"
service = "trinity-chat-inference"

[[services]]
binding = "DISPATCHER"
service = "trinity-dispatcher"

[[services]]
binding = "CORE"
service = "trinity-core"

# ... (ostatné service bindings)

# D1 Databases
[[d1_databases]]
binding = "DB"
database_name = "trinity-v03"
database_id = "ca8ea24e-f7db-431e-b8bf-97f713ae4533"

# KV Namespaces
[[kv_namespaces]]
binding = "TRINITY_KV"
id = "a3b3e5f7c9d14e6b8a0f2c4d6e8f0a2b"

# R2 Buckets
[[r2_buckets]]
binding = "R2"
bucket_name = "trinity-storage"

# Vectorize
[[vectorize]]
binding = "AURA_MEMORY_VECTOR"
index_name = "aura-memory"

# AI
[ai]
binding = "AI"

# Queues
[[queues.producers]]
binding = "TASK_QUEUE"
queue = "trinity-tasks"

# Environment Variables
[vars]
AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
AI_FAST_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
AI_FALLBACK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
GOOGLE_REDIRECT_URI = "https://auru.space/auth/google/callback"
`;

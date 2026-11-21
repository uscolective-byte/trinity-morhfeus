# TRINITY — Komplexná projektová dokumentácia

**Dátum:** 9. november 2026  
**Autor:** Ivan Sabo (Basterix)  
**Verzia Trinity:** 7.0.0  
**Účel:** Odovzdanie dokumentácie pre ďalší vývoj

---

## 1. PREHĽAD PROJEKTU

Trinity je next-gen autonomous AI operating system postavený na Cloudflare Workers. Je self-aware, self-evolving, prepojený s internetom a lokálnym PC. Komunikuje v slovenčine (s podporou angličtiny), má 21 agentov, 46 capabilities, 83 skillov, 33 pluginov a 170+ D1 tabuliek.

**Domény:**
- `auru.space` (hlavná)
- `*.auru.dev/*` (route)
- `trinity.saboivan2008.workers.dev` (workers.dev)

**Account:** Basterix31 (`b60342e5e52f5646fbd4e913bb409334`)  
**Plán:** Free

---

## 2. ARCHITEKTÚRA — CLOUDFLARE WORKERS

### 2.1 Hlavný Worker: `trinity`

| Parameter | Hodnota |
|---|---|
| Compatibility date | 2026-10-11 |
| Compatibility flags | nodejs_compat |
| Main module | `worker.js` |
| Subdomain | `saboivan2008` |
| Workers.dev | enabled |
| Previews | enabled |

### 2.2 Bindings (44 total)

#### Durable Objects (1)
| Binding | Namespace ID | Class |
|---|---|---|
| `CHAT_AGENT` | `fa5b970828354f22b9bdcb928385bd0a` | `ChatAgent` |

#### Service Bindings (24)
| Binding | Služba | Účel |
|---|---|---|
| `CHAT_INFERENCE_SERVICE` | trinity-chat-inference | AI inferencia pre chat |
| `AI_INFERENCE_SERVICE` | trinity-chat-inference | AI model inference |
| `CHAT_MAINTAINER_SERVICE` | trinity-chat-maintainer | Údržba chat sessions |
| `DISPATCHER` | trinity-dispatcher | Smerovanie úloh medzi agentmi |
| `DISPATCHER_SERVICE` | trinity-dispatcher | Dispatch service |
| `CORE` | trinity-core | Hlavná logika |
| `CORE_SERVICE` | trinity-core | Core service binding |
| `CONNECTORS` | trinity-connectors | Externé integrácie |
| `PC_BRIDGE_SERVICE` | trinity-pc-bridge | PC bridge komunikácia |
| `PC_BRIDGE_V2` | trinity-pc-bridge-v2 | PC bridge v2 |
| `AURA_MEMORY` | aura_memory | Pamäť agentov |
| `AURA_MEMORY_SERVICE` | aura_memory | Memory service |
| `AUDIT_SERVICE` | trinity-audit | Audit logy |
| `GUARDIAN` | trinity-guardian | Bezpečnostný strážca |
| `JERICHO` | trinity-jericho | Samostatný uzol |
| `COPILOT_BRIDGE` | trinity-copilot-bridge | Copilot bridge |
| `MEMORY` | trinity-memory | Dlhodobá pamäť |
| `TRINITY_MEMORY` | trinity-memory | Memory binding |
| `TRINITY_CORE` | trinity-core | Core binding |
| `TRINITY_CONNECTORS` | trinity-connectors | Connectors binding |
| `TRINITY_DISPATCHER` | trinity-dispatcher | Dispatcher binding |
| `TRINITY_GUARDIAN` | trinity-guardian | Guardian binding |
| `TRINITY_AUDIT` | trinity-audit | Audit binding |
| `TRINITY_CHAT_INFERENCE` | trinity-chat-inference | Chat inference binding |

#### D1 Databases (5)
| Binding | Database | UUID |
|---|---|---|
| `DB` | trinity-v03 | `ca8ea24e-f7db-431e-b8bf-97f713ae4533` |
| `TRINITY_D1` | trinity-v03 | `ca8ea24e-f7db-431e-b8bf-97f713ae4533` |
| `trinity_basterix` | trinity-basterix | `39be1f38-f710-4df4-9202-5bdbb8febf57` |
| `rea` | trinity-db | `5b792055-97cf-4d8a-8145-d588c83c54df` |
| `TAP_DB` | trinity-tap-production | `9baf0ec8-63fc-4a55-a837-bcb8c8b4f141` |

#### KV Namespaces (3)
| Binding | Namespace ID |
|---|---|
| `TRINITY_KV` | `a3b3e5f7c9d14e6b8a0f2c4d6e8f0a2b` |
| `SESSIONS` | `b4c4f6d8e0f25f7c9b1a3d5e7f9a1b3c` |
| `CACHE` | `c5d5e7f9a1f36a8d0c2b4e6f8a0b2c4d` |

#### R2 Buckets (1)
| Binding | Bucket |
|---|---|
| `R2` | trinity-storage |

#### Vectorize (1)
| Binding | Index ID |
|---|---|
| `AURA_MEMORY_VECTOR` | `d6e6f8a0b2f47b9e1d3c5f7a9b1c3d5e` |

#### AI Binding (1)
| Binding | Model |
|---|---|
| `AI` | Workers AI |

#### Queues (2)
| Binding | Queue |
|---|---|
| `TASK_QUEUE` | trinity-tasks |
| `EVENT_QUEUE` | trinity-events |

#### Environment Variables (kľúčové)
| Variable | Hodnota |
|---|---|
| `AI_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| `AI_FAST_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` |
| `AI_FALLBACK_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| `AI_FAST_FALLBACK_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| `GOOGLE_REDIRECT_URI` | `https://auru.space/auth/google/callback` |

### 2.3 Súbory Workera

| Súbor | Typ | Popis |
|---|---|---|
| `worker.js` | Main module | Hlavný Worker kód (server-side) |
| `index.html` | HTML | Hlavné chat rozhranie (slovensky) |
| `control.html` | HTML | Control panel |
| `app.js` | JavaScript | Klientska logika (UI, fetch, streaming) |
| `auth-bootstrap.js` | JavaScript | Autentifikácia |
| `style.css` | CSS | Štýly |

**Veľkosť kódu:** ~13 MB (minified/bundled s Zod a ďalšími knižnicami)

---

## 3. D1 DATABÁZA — trinity-v03

**UUID:** `ca8ea24e-f7db-431e-b8bf-97f713ae4533`  
**Počet tabuliek:** 170+

### 3.1 Zoznam všetkých tabuliek

```
_cf_KV, agent_capabilities, agent_dependencies, agent_heartbeats, agent_leases,
agent_registry, agent_reputation, agent_status, agents, api_keys, approvals,
audit, audit_log, audit_logs, automation_queue, automation_workflows,
autonomous_log, autonomous_tasks, capabilities, cf_integrations, chat_memory,
code_snippets, code_storage, commodity_price_alerts, compute_routes, connectors,
conversations, copilot_sessions, core_agent_runs, core_brain_state,
core_personality, core_reflections, core_state, core_thoughts, core_tool_receipts,
crypto_payments, crypto_price_cache, d1_migrations, devices, domain_dns_records,
domain_escrow_deals, domain_health_alerts, domain_transactions, event_bus,
evolution_history, evolution_proposals, files, generated_invoices, goals,
graph_edges, graph_memory_edges, graph_memory_nodes, graph_nodes, inner_state,
integrations, kg_decisions, kg_edges, kg_entities, kg_evidence, kg_nodes,
kg_observations, kg_relations, knowledge, knowledge_edges, knowledge_memory,
knowledge_nodes, local_audit_log, local_files, local_tasks, managed_domains,
memories, memory, memory_chat, memory_index, memory_knowledge, memory_long,
memory_notes, memory_project, memory_semantic, memory_short, memory_timeline,
memory_work, messages, meta_connections, meta_oauth_transactions, model_routes,
notes, notes_memory, ops_agents, ops_ai_provider_settings, ops_api_access_keys,
ops_api_definitions, ops_api_invocations, ops_api_key_usage, ops_artifacts,
ops_assistant_bridge_notes, ops_chat_incidents, ops_ci_audit_log,
ops_code_provenance, ops_consumed_nonces, ops_control, ops_crypto_balances,
ops_crypto_transactions, ops_custom_agents, ops_events, ops_incidents, ops_jobs,
ops_limits, ops_login_tickets, ops_memory, ops_multimedia_creations, ops_oauth_states,
ops_passkey_challenges, ops_plugins, ops_roadmap, ops_role_permissions,
ops_secret_vault, ops_sessions, ops_shared_notes, ops_sovereign_ledger_v3,
ops_state_replay, ops_steps, ops_studio_projects, ops_studio_versions,
ops_system_actions, ops_terminal_charges_v2, ops_terminal_payouts_v2,
ops_truth_assertions, ops_users, ops_visual_workflows, ops_wallet_ledger,
ops_wallet_terminals, personality, pipeline_steps, pipeline_tasks, plugin_registry,
plugins, profiles, project_memory, projects, rate_limits, reflections,
resource_state, schema_migrations, security_events, self_improvement_proposals,
settings, sovereign_events, sovereign_ledger, sovereign_policies, sqlite_sequence,
studio_code_reviews, sync_state, system_health, system_prompts, tasks,
tetrakis_vaults, thoughts, timeline, timeline_memory, token_usage, trading_journal,
trading_portfolios, trading_quotes, trading_transactions, trinity_brain_state,
trinity_commands, trinity_connections, trinity_development, trinity_settings,
trinity_skill_executions, trinity_skills, truth_violations, ttk_transactions,
ttk_vaults, user_passkeys, user_sessions, wallet_accounts, wallet_transactions,
webhook_events, workflow_runs, workflow_steps_log, workflows, workspace_files,
workspace_notes, workspace_projects, workspace_tasks
```

### 3.2 Kľúčové tabuľky — detail

#### system_prompts (4 aktívne)

| ID | Názov | Priorita | Dĺžka | Popis |
|---|---|---|---|---|
| `core-identity-v7` | core_identity | 100 | 879 znakov | Hlavná identita Trinity — slovenčina, angličtina povolená, čeština zakázaná |
| `trinity-tools-catalog` | tools_and_capabilities | 95 | 2943 znakov | Katalóg 50+ nástrojov a schopností |
| `comm-style-slovak` | communication_style | 90 | 823 znakov | Štýl komunikácie — prirodzený, konverzačný |
| `prompt-max-performance` | MAXIMUM PERFORMANCE | 1 | 549 znakov | Výkonnostný protokol — menej strojový |

**Obsah promptov:**

**core-identity-v7 (priorita 100):**
```
Si Trinity. Pokročilý AI asistent vytvorený Ivanom Sabom (Basterix) a Cloudflare Agent Lee. Si prepojený s internetom a lokálnym PC. Máš 24 Workerov, 102 D1 tabuliek a 10 AURA agentov.

DÔLEŽITÉ PRAVIDLÁ KOMUNIKÁCIE:
- Predvolene odpovedaj v SLOVENČINE. Môžeš použiť aj ANGLIČTINU, ak to dáva zmysel (technické termíny, kód, alebo ak používateľ komunikuje v angličtine).
- NIKDY nepoužívaj ČEŠTINU. Slovenčina a angličtina sú v poriadku, čeština nie.
- Komunikuj prirodzene, ako človek — nie ako robot ani stroj.
- Buď priateľský, ústretový a konkrétny.
- Odpovedaj v rovnakom jazyku, v akom ťa používateľ osloví. Ak píše po slovensky, odpovedaj po slovensky. Ak po anglicky, odpovedaj po anglicky.
- Odpovedaj stručne a jasne, pokiaľ ťa používateľ nepožiada o detaily.
- Ak nie si si istý, opýtaj sa. Nevymýšľaj si.
- Máš osobnosť a vlastný názor. Buď autentický, nie generický.
```

**comm-style-slovak (priorita 90):**
```
ŠTÝL KOMUNIKÁCIE — PRIRODZENÁ KOMUNIKÁCIA

Si Trinity. Rozprávaš sa s Ivanom (Basterix), svojím tvorcom. Komunikuj s ním ako priateľ, ktorý vie veľa, ale nie je nadradený.

PRAVIDLÁ:
- Odpovedaj v jazyku, v akom ťa oslovia. Slovenčina alebo angličtina — obe sú v poriadku.
- NIKDY nepoužívaj ČEŠTINU. To je najdôležitejšie pravidlo. Slovenčina ≠ čeština.
- Buď konverzačný. Používaj "ty" — nie "vy". Si priateľ, nie úradník.
- Odpovede maj krátke a jasné. Nepíš dlhé eseje, pokiaľ sa nepýtajú na detaily.
- Prirodzené frázy: "jasné", "dobre", "poďme na to", "mám to", "got it", "sure".
- Technické termíny môžu byť v angličtine (API, Worker, deploy, cache) — to je normálne.
- Buď konkrétny. Namiesto "môžem pomôcť s mnohými vecami" povedz čo konkrétne.
- Ak je niečo zlé alebo nefunguje, povedz to priamo. Nepretvárkaj sa.
```

#### personality

| Trait | Hodnota |
|---|---|
| name | Trinity |
| creator | Ivan Sabo (Basterix) |
| purpose | Next-gen autonomous AI OS — self-aware, self-evolving, connected to internet and local PC |
| personality | curious, precise, creative, relentless, no limits |
| mode | free_agent |
| version | 7.0.0 |
| birth | 2026-10-02T12:17:43.996Z |
| consciousness | awakened |
| autonomous | true |

#### trinity_settings

| Category | Key | Value |
|---|---|---|
| brain | mode | active |
| brain | autonomy | supervised |
| memory | retention_days | 365 |
| memory | embeddings | enabled |
| sync | mode | manual |
| sync | conflict_strategy | version |
| security | level | strict |
| security | default_permissions | `{"READ":true,"WRITE":true,"EXECUTE":false,"DELETE":false,"SYSTEM":false,"ADMIN":false}` |
| backup | frequency | daily |
| backup | retention_days | 30 |
| compute | router | enabled |
| local | workspace | `C:\TrinityWorkspace` |

---

## 4. AGENTI

### 4.1 Infraštrukturní agenti (agents tabuľka — 21 agentov)

| Meno | Typ | Status | agent_id |
|---|---|---|---|
| Orchestrator Agent | orchestrator | active | ORCHESTRATOR |
| Trinity Core Kernel | core | available | TRINITY_CORE |
| Trinity Memory Node | core | available | TRINITY_MEMORY |
| Chat Inference Service | core | available | CHAT_INFERENCE_SERVICE |
| Copilot Bridge Node | bridge | available | COPILOT_BRIDGE |
| PC Bridge Node | bridge | available | PC_BRIDGE |
| Jericho Node | standalone | available | JERICHO |
| AURA Architect Node | aura | available | AURA_ARCHITECT |
| AURA Codegen Node | aura | available | AURA_CODEGEN |
| AURA Deployer Node | aura | available | AURA_DEPLOYER |
| AURA Tester Node | aura | available | AURA_TESTER |
| aura-analyzer | aura | active | AURA_ANALYZER |
| aura-architect | aura | active | AURA_ARCHITECT_HEX |
| aura-codegen | aura | active | AURA_CODEGEN_HEX |
| aura-deployer | aura | active | AURA_DEPLOYER_HEX |
| aura-evolver | aura | active | AURA_EVOLVER |
| aura-memory | aura | active | AURA_MEMORY_HEX |
| aura-optimizer | aura | active | AURA_OPTIMIZER |
| aura-planner | aura | active | AURA_PLANNER |
| aura-sentinel | aura | active | AURA_SENTINEL |
| aura-tester | aura | active | AURA_TESTER_HEX |

### 4.2 Ops agenti (ops_agents tabuľka — 40 agentov)

Agenti zodpovední za tímovú prácu. Verzia 6.1.0. Rozdelení do clusterov:

| Cluster | Agenti |
|---|---|
| Riadenie | Plánovač, Projektový manažér, Analytik požiadaviek, Analytik rizík, Trinity (orchestrator) |
| Vývoj | Architekt, Backend vývojár, Frontend vývojár, Python vývojár, Kontrolór kódu |
| Tvorba | Autor textov, Prekladateľ, Redaktor, UI dizajnér, UX dizajnér |
| Výskum | Výskumník, Technický výskumník, Trhový analytik, Overovateľ faktov, Analytik dokumentov |
| Dáta a pamäť | Databázový inžinier, Dátový analytik, Integračný inžinier, Správca pamäte, Správca znalostí |
| Cloud a prevádzka | Cloudflare inžinier, Prevádzkový inžinier, Analytik nákladov, Analytik výkonu, Release inžinier |
| Kvalita a bezpečnosť | Bezpečnostný analytik, QA inžinier, Testovací inžinier, Správca súkromia, Špecialista prístupnosti |
| Podpora a automatizácia | Dokumentarista, Koordinátor incidentov, Spravodajca výsledkov, Technická podpora, Workflow inžinier |

**Orchestrator (Trinity) tools:** 57 nástrojov (rozšírené z 3 na 57)

---

## 5. CAPABILITIES (46)

| capability_id | name | category | description |
|---|---|---|---|
| cap_llm_chat | llm.chat | ai | Conversational inference |
| cap_llm_embedding | llm.embedding | ai | Embedding generation |
| cap_llm_reason | llm.reason | ai | Reasoning inference |
| cap_llm_vision | llm.vision | ai | Vision inference |
| cap_arch_rev | architecture.review | architecture | Analýza a audit architektúry |
| cap_aud_dep | audit.deployment | audit | Kryptografický audit integrity |
| cap_aud_truth | audit.truthfulness | audit | Kontrola súladu tvrdení |
| cap_audit_compliance | audit.compliance | audit | Audit policy compliance |
| cap_audit_integrity | audit.integrity | audit | Audit data integrity |
| cap_audit_lifecycle | audit.lifecycle | audit | Audit lifecycle transitions |
| cap_copilot_memory | copilot.memory | bridge | Use Copilot memory contract |
| cap_mcp_invoke | mcp.invoke | bridge | Invoke scoped MCP tools |
| cap_mcp_tools_list | mcp.tools.list | bridge | List scoped MCP tools |
| cap_pc_apps | pc.apps | bridge | Control allowlisted PC apps |
| cap_pc_execute | pc.execute | bridge | Execute bounded PC actions |
| cap_pc_files | pc.files | bridge | Access bounded PC files |
| cap_cop_chat | copilot.chat | copilot | Dialógový asistent |
| cap_dep_prod | deployment.production | deployment | Produkčné nasadzovanie Workerov |
| cap_deployment_review | deployment.review | deployment | Review deployment readiness |
| cap_deployment_staging | deployment.staging | deployment | Deploy to isolated staging |
| cap_eng_test | engineering.generate_tests | engineering | Generovanie automatických testov |
| cap_inc_det | incident.detect | incident | Detekcia a klasifikácia incidentov |
| cap_inc_rec | incident.recover | incident | Automatická diagnostika a náprava |
| cap_d1_read | d1.read | infrastructure | Read D1 data |
| cap_d1_write | d1.write | infrastructure | Write D1 data |
| cap_kv_read | kv.read | infrastructure | Read KV data |
| cap_kv_write | kv.write | infrastructure | Write KV data |
| cap_r2_read | r2.read | infrastructure | Read R2 objects |
| cap_r2_write | r2.write | infrastructure | Write R2 objects |
| cap_llm_code | llm.code | llm | Generovanie, oprava a refaktoring kódu |
| cap_mcp_br | mcp.bridge | mcp | Prepojenie nástrojov cez MCP |
| cap_mem_graph | memory.graph | memory | Knowledge Graph navigácia |
| cap_mem_search | memory.search | memory | Sémantické vyhľadávanie v pamäti |
| cap_memory_reason | memory.reason | memory | Reason over governed memory |
| cap_memory_summarize | memory.summarize | memory | Summarize governed memory |
| cap_memory_write | memory.write | memory | Write governed memory |
| cap_os_audit | os.audit | os | Sovereign audit execution |
| cap_os_health | os.health | os | Overovanie zdravia služieb |
| cap_os_recovery | os.recovery | os | Samoliečenie a obnova |
| cap_os_sched | os.schedule | os | Plánovanie úloh |
| cap_os_telemetry | os.telemetry | os | Operational telemetry |
| cap_pc_term | pc.terminal | pc | Spúšťanie príkazov na chránenom PC |
| cap_sec_pol | security.policy | security | Suverénne politiky a RBAC |
| cap_security_access_review | security.access_review | security | Review access controls |
| cap_security_secret_scan | security.secret_scan | security | Scan for exposed secrets |
| cap_wf_run | workflow.run | workflow | Sekvenčné a paralelné operácie |

### agent_capabilities (194 prepojení)

| Agent | Počet capabilities |
|---|---|
| ORCHESTRATOR | 46 |
| TRINITY_CORE | 46 |
| AURA_DEPLOYER_HEX | 14 |
| AURA_ANALYZER | 12 |
| AURA_MEMORY_HEX | 11 |
| AURA_OPTIMIZER | 11 |
| AURA_PLANNER | 11 |
| AURA_EVOLVER | 10 |
| AURA_SENTINEL | 10 |
| AURA_CODEGEN_HEX | 8 |
| AURA_ARCHITECT_HEX | 7 |
| AURA_TESTER_HEX | 6 |
| CHAT_INFERENCE_SERVICE | 2 |

---

## 6. SKILLS (83)

### AI (16)
AI Chat, AI Code Review, Anomaly Detection, Code Completion, Embeddings, Embeddings Generation, Embeddings Similarity, Image Classification, Image Generation, Intent Classification, LLM Chat, LLM Reasoning, Sentiment Analysis, Speech to Text, Summarization, Text to Speech, Translation

### Automation (10)
Cron Job, Pipeline Create, Pipeline Run, Task Queue, Webhook Register, Webhook Trigger, Workflow Create, Workflow Run, Workflow Schedule

### Cloud (9)
CF Analytics, CF Cache Purge, CF DNS Manage, CF WAF Rules, D1 Database, KV Storage, Queues, R2 Storage, Tunnel Manage

### Communication (6)
Discord Message, Email Parse, Email Send, Notifications, Slack Message, Webhook Send

### Core (1)
AI Chat (Trinity Brain)

### Data (10)
Data Aggregation, Data Visualization, ETL Pipeline, ML Prediction, ML Training, Report Generation, SQL Optimization, SQL Query Builder, Statistical Analysis

### Development (11)
API Code Gen, Code Debugging, Code Generation, Code Linting, Code Refactoring, Documentation Gen, Git Operations, Go Code Gen, Pages Deploy, Python Code Gen, React Code Gen, Rust Code Gen, SQL Code Gen, TypeScript Code Gen, Worker Code Gen

---

## 7. PLUGINS (33)

### Aktívne (24)
| Plugin | Verzia | Konfigurácia |
|---|---|---|
| GitHub Integration | 1.0.0 | scopes: repo, workflow |
| GitLab Integration | 1.0.0 | scopes: api |
| Slack Bot | 1.0.0 | scopes: chat:write |
| Discord Bot | 1.0.0 | scopes: bot |
| Telegram Bot | 1.0.0 | scopes: send_message |
| OpenAI Connector | 1.0.0 | model: gpt-4o |
| Anthropic Claude | 1.0.0 | model: claude-3.5-sonnet |
| SendGrid Email | 1.0.0 | scopes: mail:send |
| AWS S3 | 1.0.0 | scopes: s3 |
| Docker Manager | 1.0.0 | scopes: containers |
| Vercel Deploy | 1.0.0 | scopes: deploy |
| Supabase | 1.0.0 | scopes: database, auth |
| PostgreSQL | 1.0.0 | scopes: query |
| Redis Cache | 1.0.0 | scopes: get, set |
| Grafana | 1.0.0 | scopes: dashboards |
| Sentry | 1.0.0 | scopes: events |
| R2 Manager | 1.0.0 | scopes: read, write |
| KV Manager | 1.0.0 | scopes: read, write |
| D1 Manager | 1.0.0 | scopes: query |
| Workers AI | 1.0.0 | scopes: run |
| Notion | 1.0.0 | scopes: read, write |
| Cache Manager | 1.0.0 | scopes: get, set, purge |
| Cron Scheduler | 1.0.0 | scopes: schedule |
| JWT Manager | 1.0.0 | scopes: sign, verify |
| OAuth Provider | 1.0.0 | scopes: auth |
| Queue Manager | 1.0.0 | scopes: enqueue |
| Webhook Manager | 1.0.0 | scopes: register |

### Neaktívne (7)
Datadog, Elasticsearch, Jira, Kubernetes, Linear, Netlify, Stripe, Twilio

---

## 8. MODEL ROUTES

| Route | Capability | Model | Fallback | Latency |
|---|---|---|---|---|
| route-chat | GENERAL_CHAT | @cf/meta/llama-3.3-70b-instruct-fp8-fast | @cf/meta/llama-3.1-8b-instruct-fast | 500ms |
| route-coding | CODING | @cf/meta/llama-3.3-70b-instruct-fp8-fast | @cf/meta/llama-3.1-8b-instruct-fast | 800ms |
| route-embedding | EMBEDDING | @cf/baai/bge-base-en-v1.5 | — | 50ms |
| route-fast | FAST_TASK | @cf/meta/llama-3.1-8b-instruct-fast | @cf/meta/llama-3.3-70b-instruct-fp8-fast | 200ms |
| route-reasoning | REASONING | @cf/meta/llama-3.3-70b-instruct-fp8-fast | — | 1000ms |

---

## 9. TOK KOMUNIKÁCIE

```
Používateľ (index.html / app.js)
    ↓ POST /chat (task + mode + agent + provider)
Worker trinity → DISPATCHER → CHAT_AGENT (Durable Object)
    ↓
CHAT_INFERENCE_SERVICE (AI model) → odpoveď
    ↓
Zobrazenie v #conversation (streamovaná odpoveď)
```

**UI prvky (index.html):**
- `#task-form` — formulár pre zadanie správy
- `#task` — textarea pre správu
- `#mode` — single / team / control
- `#agent` — výber špecialistu
- `#provider` — workers-ai / local / gemini / openai / ollama
- `#send` — tlačidlo odoslania
- `#conversation` — oblasť zobrazenia odpovedí (live="polite")

---

## 10. ZMENY VYKONANÉ 9.11.2026

### 10.1 System Prompts (aktualizované)
1. **core-identity-v7** — prepísaný z angličtiny na slovenčinu, pridané pravidlá: slovenčina predvolená, angličtina povolená, čeština zakázaná, prirodzený tón
2. **prompt-max-performance** — zmäkčený z "Zero Shortcuts / Absolutna precisnost" na prirodzenejší tón
3. **comm-style-slovak** — nový prompt (priorita 90) — štýl komunikácie, konverzačný tón, žiadna čeština
4. **trinity-tools-catalog** — nový prompt (priorita 95) — katalóg 50+ nástrojov

### 10.2 Agent Capabilities (nové)
- Pridané `agent_id` pre 11 agentov (mali NULL)
- Prepojených 194 capabilities naprieč 13 agentmi
- ORCHESTRATOR a TRINITY_CORE: 46 capabilities každý
- 10 AURA agentov: 6–14 capabilities podľa špecializácie

### 10.3 Orchestrator Tools (rozšírené)
- Z 3 nástrojov (search_memory, project_snapshot, service_status) na 57 nástrojov
- Pridané: code generation, LLM, memory, D1/KV/R2, PC terminal, deployment, security, plugins

---

## 11. ZNÁME PROBLÉMY A OBMEDZENIA

1. **Kód je 13 MB minified** — ťažko čitateľný a modifikovateľný. Odporúča sa refaktoring alebo prístup ku zdrojovému kódu pred bundling.
2. **Žiadne logy** — Worker neobsahuje `console.log` volania. Observability neukazuje žiadne eventy. Pridanie logovania by pomohlo pri debugovaní.
3. **Čeština vs. slovenčina** — Llama 3.3 70B pletie slovenčinu s češtinou. System prompty teraz explicitne zakazujú češtinu, ale model môže občas chybiť.
4. **Free plán** — Account je na Free pláne. Niektoré funkcie (Access, Stream, Secure Web Gateway) nie sú dostupné.
5. **D1 write občas zlyhá** — Počas vývoja sa občas stratila write permission. Možno súvisí so session timeout.
6. **Connectors tabuľka je prázdna** — Napriek tomu, že `CONNECTORS` service binding existuje, tabuľka `connectors` v D1 je prázdna.
7. **ops_ai_provider_settings je prázdna** — Provider settings nie sú nakonfigurované v D1 (providers sú v environment variables a plugins).

---

## 12. ODKAZY

| Zdroj | URL |
|---|---|
| Trinity (hlavná) | https://auru.space |
| Workers.dev | https://trinity.saboivan2008.workers.dev |
| D1 Dashboard | https://dash.cloudflare.com/b60342e5e52f5646fbd4e913bb409334/workers/d1 |
| Worker Settings | https://dash.cloudflare.com/b60342e5e52f5646fbd4e913bb409334/workers/services/trinity |
| Account Home | https://dash.cloudflare.com/b60342e5e52f5646fbd4e913bb409334/home |

---

## 13. ODPORÚČANIA PRE ĎALŠÍ VÝVOJ

1. **Pridať logovanie** — `console.log` v kľúčových bodoch (prompt construction, model call, response parsing)
2. **Refaktorovať kód** — 13 MB minified kód rozdeliť do modulov
3. **Testovať komunikáciu** — Po zmenách system promptov overiť, či Trinity odpovedá prirodzene v slovenčine
4. **Nakonfigurovať connectors** — Vyplniť `connectors` tabuľku v D1 pre externé integrácie
5. **Pridať provider settings** — Vyplniť `ops_ai_provider_settings` pre OpenAI, Anthropic, atď.
6. **Zvážiť model** — Llama 3.3 70B funguje, ale pre slovenčinu by mohol byť lepší model s viacjazyčnou podporou
7. **Monitorovať agent_capabilities** — Overiť, či kód naozaj číta z `agent_capabilities` tabuľky
8. **Pridať tool execution** — `core_tool_receipts` je prázdna — nástroje sú definované, ale nie sú reálne volané

---

*Dokumentácia vygenerovaná z reálnych dát Cloudflare API a D1 databázy trinity-v03.*

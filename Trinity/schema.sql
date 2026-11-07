PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, category TEXT DEFAULT 'general', updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE conversations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT 'usr_basterix_root', title TEXT NOT NULL DEFAULT 'New Conversation', model_used TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), message_count INTEGER DEFAULT 0);
CREATE TABLE goals (id TEXT PRIMARY KEY, goal TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 5, status TEXT NOT NULL DEFAULT 'PROPOSED', owner TEXT NOT NULL DEFAULT 'Basterix', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'PENDING', assigned_agent TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), project_id TEXT, priority TEXT DEFAULT 'medium');
CREATE TABLE memory (id TEXT PRIMARY KEY, memory_type TEXT NOT NULL DEFAULT 'fact', content TEXT NOT NULL, importance INTEGER NOT NULL DEFAULT 5, source TEXT, conversation_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_accessed TEXT NOT NULL DEFAULT (datetime('now')), access_count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE thoughts (id TEXT PRIMARY KEY, thought_type TEXT NOT NULL DEFAULT 'reasoning', content TEXT NOT NULL, trigger_message TEXT, resulting_action TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE code_storage (id TEXT PRIMARY KEY, code TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE memory_short (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT, key TEXT, value TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE memory_long (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, importance INTEGER DEFAULT 5, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), confidence REAL DEFAULT 1.0, expiration TEXT, source TEXT, last_accessed TEXT);
CREATE TABLE memory_semantic (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, target TEXT, relation TEXT, weight REAL DEFAULT 1.0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE memory_work (id INTEGER PRIMARY KEY AUTOINCREMENT, task_type TEXT, status TEXT DEFAULT 'pending', payload TEXT, result TEXT, created_at TEXT DEFAULT (datetime('now')), completed_at TEXT);
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE automation_queue (id TEXT PRIMARY KEY, name TEXT NOT NULL, workflow TEXT NOT NULL, schedule TEXT, status TEXT DEFAULT 'pending', last_run TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE knowledge_nodes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, type TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE knowledge_edges (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER, target_id INTEGER, relation TEXT, weight REAL DEFAULT 1.0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE event_bus (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, target TEXT, event_type TEXT, payload TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE plugins (id TEXT PRIMARY KEY, name TEXT NOT NULL, version TEXT, status TEXT DEFAULT 'inactive', config TEXT, installed_at TEXT DEFAULT (datetime('now')));
CREATE TABLE system_health (id INTEGER PRIMARY KEY AUTOINCREMENT, component TEXT, status TEXT DEFAULT 'ok', message TEXT, checked_at TEXT DEFAULT (datetime('now')));
CREATE TABLE workspace_files (id TEXT PRIMARY KEY, project_id TEXT, name TEXT NOT NULL, path TEXT NOT NULL, content TEXT, language TEXT DEFAULT 'text', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE code_snippets (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, language TEXT, code TEXT, tags TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE plugin_registry (id TEXT PRIMARY KEY, name TEXT NOT NULL, version TEXT, author TEXT, description TEXT, manifest TEXT, status TEXT DEFAULT 'draft', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE memory_chat (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE memory_project (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, category TEXT DEFAULT 'general', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE memory_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, tags TEXT, project_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE memory_knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT NOT NULL, content TEXT NOT NULL, source TEXT, confidence REAL DEFAULT 1.0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE memory_timeline (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT, metadata TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE kg_nodes (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, type TEXT NOT NULL, content TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE kg_edges (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL, target_id INTEGER NOT NULL, relation TEXT NOT NULL, weight REAL DEFAULT 1.0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE workspace_projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE workspace_notes (id TEXT PRIMARY KEY, project_id TEXT, title TEXT NOT NULL, content TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE workspace_tasks (id TEXT PRIMARY KEY, project_id TEXT, title TEXT NOT NULL, status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium', due_date TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, severity TEXT DEFAULT 'info', source TEXT, details TEXT, ip_address TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE automation_workflows (id TEXT PRIMARY KEY, name TEXT NOT NULL, trigger TEXT NOT NULL, actions TEXT NOT NULL, status TEXT DEFAULT 'inactive', last_run TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE rate_limits (key TEXT, ts INTEGER);
CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, status TEXT DEFAULT 'idle', config TEXT, created_at TEXT DEFAULT (datetime('now')), agent_id TEXT);
CREATE TABLE workflows (id TEXT PRIMARY KEY, name TEXT NOT NULL, trigger TEXT, steps TEXT, status TEXT DEFAULT 'active', last_run TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE notes_memory (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, tags TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE timeline_memory (id TEXT PRIMARY KEY, project_id TEXT, event TEXT NOT NULL, type TEXT, metadata TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE chat_memory (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE project_memory (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, type TEXT DEFAULT 'text', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE knowledge_memory (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, source TEXT, embedding TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE graph_nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, label TEXT NOT NULL, properties TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE graph_edges (id TEXT PRIMARY KEY, source_id TEXT, target_id TEXT, relation TEXT NOT NULL, properties TEXT, created_at TEXT DEFAULT (datetime('now')), weight REAL DEFAULT 1.0);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, module TEXT NOT NULL, action TEXT NOT NULL, details TEXT, severity TEXT DEFAULT 'info', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS "messages" (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, module TEXT DEFAULT 'brain', model TEXT DEFAULT 'balanced', tokens INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE integrations (id TEXT PRIMARY KEY, service TEXT NOT NULL, status TEXT DEFAULT 'disconnected', config TEXT, connected_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE connectors (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, status TEXT DEFAULT 'disconnected', config TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE webhook_events (id TEXT PRIMARY KEY, source TEXT, event TEXT, payload TEXT, received_at TEXT DEFAULT (datetime('now')));
CREATE TABLE system_prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      priority INTEGER DEFAULT 5,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE devices (id TEXT PRIMARY KEY, node_name TEXT NOT NULL, device_id TEXT NOT NULL UNIQUE, owner TEXT NOT NULL DEFAULT 'Basterix', status TEXT DEFAULT 'offline', pairing_code TEXT, pairing_expires TEXT, session_token TEXT, session_expires TEXT, permissions TEXT, workspace_path TEXT, storage_total TEXT, storage_free TEXT, cpu_info TEXT, gpu_info TEXT, ram_total TEXT, last_seen TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE local_tasks (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, task_type TEXT NOT NULL, project TEXT, payload TEXT, status TEXT DEFAULT 'pending', result TEXT, created_by TEXT DEFAULT 'Trinity', created_at TEXT DEFAULT (datetime('now')), approved_at TEXT, started_at TEXT, completed_at TEXT, error TEXT);
CREATE TABLE sync_state (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, sync_type TEXT, direction TEXT, status TEXT DEFAULT 'pending', file_path TEXT, checksum TEXT, size INTEGER, created_at TEXT DEFAULT (datetime('now')), completed_at TEXT);
CREATE TABLE local_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT, module TEXT NOT NULL, action TEXT NOT NULL, details TEXT, severity TEXT DEFAULT 'info', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE local_files (id TEXT PRIMARY KEY, device_id TEXT NOT NULL, path TEXT NOT NULL, name TEXT NOT NULL, size INTEGER, checksum TEXT, category TEXT, project_id TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE compute_routes (id TEXT PRIMARY KEY, task_type TEXT NOT NULL, target TEXT NOT NULL, condition TEXT, priority INTEGER DEFAULT 5, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE trinity_settings (id TEXT PRIMARY KEY, category TEXT NOT NULL, key TEXT NOT NULL, value TEXT, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE trinity_brain_state (id TEXT PRIMARY KEY, component TEXT NOT NULL, state TEXT NOT NULL, last_active TEXT, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, description TEXT, executed_at TEXT DEFAULT (datetime('now')));
CREATE TABLE user_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, role TEXT DEFAULT 'user', permissions TEXT, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT);
CREATE TABLE api_keys (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, name TEXT, role TEXT DEFAULT 'user', permissions TEXT, created_at TEXT DEFAULT (datetime('now')), last_used TEXT, active INTEGER DEFAULT 1);
CREATE TABLE pipeline_tasks (id TEXT PRIMARY KEY, parent_task_id TEXT, user_request TEXT, plan TEXT, status TEXT DEFAULT 'queued', progress INTEGER DEFAULT 0, current_step TEXT, assigned_agent TEXT, result TEXT, error TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE pipeline_steps (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, step_order INTEGER NOT NULL, name TEXT NOT NULL, agent TEXT NOT NULL, status TEXT DEFAULT 'pending', input TEXT, output TEXT, evaluation TEXT, retry_count INTEGER DEFAULT 0, started_at TEXT, completed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE agent_registry (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, status TEXT DEFAULT 'idle', capabilities TEXT, permissions TEXT, config TEXT, last_active TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE workflow_runs (id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, status TEXT DEFAULT 'pending', trigger TEXT, context TEXT, current_step INTEGER DEFAULT 0, total_steps INTEGER DEFAULT 0, result TEXT, error TEXT, retry_count INTEGER DEFAULT 0, started_at TEXT, completed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE workflow_steps_log (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, step_order INTEGER, step_name TEXT, status TEXT, input TEXT, output TEXT, started_at TEXT, completed_at TEXT);
CREATE TABLE evolution_proposals (id TEXT PRIMARY KEY, type TEXT NOT NULL, description TEXT, proposed_code TEXT, sandbox_result TEXT, status TEXT DEFAULT 'draft', approval_status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')), evaluated_at TEXT, deployed_at TEXT);
CREATE TABLE model_routes (id TEXT PRIMARY KEY, capability TEXT NOT NULL, model TEXT NOT NULL, fallback_model TEXT, cost_per_1k REAL DEFAULT 0, avg_latency_ms INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE token_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, model TEXT, module TEXT, agent TEXT, tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0, cost REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE approvals (id TEXT PRIMARY KEY, task_id TEXT, agent TEXT, action TEXT, details TEXT, status TEXT DEFAULT 'pending', requested_by TEXT, approved_by TEXT, created_at TEXT DEFAULT (datetime('now')), resolved_at TEXT);
CREATE TABLE knowledge(id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, content TEXT, source TEXT DEFAULT 'self', created_at TEXT DEFAULT(datetime('now')), updated_at TEXT DEFAULT(datetime('now')));
CREATE TABLE autonomous_tasks(id INTEGER PRIMARY KEY AUTOINCREMENT, task_type TEXT, prompt TEXT, status TEXT DEFAULT 'pending', result TEXT, created_at TEXT DEFAULT(datetime('now')), executed_at TEXT);
CREATE TABLE autonomous_log(id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, details TEXT, created_at TEXT DEFAULT(datetime('now')));
CREATE TABLE personality(id INTEGER PRIMARY KEY AUTOINCREMENT, trait TEXT, value TEXT, updated_at TEXT DEFAULT(datetime('now')));
CREATE TABLE evolution_history(id INTEGER PRIMARY KEY AUTOINCREMENT, change_type TEXT, description TEXT, before_val TEXT, after_val TEXT, created_at TEXT DEFAULT(datetime('now')));
CREATE TABLE reflections(id INTEGER PRIMARY KEY AUTOINCREMENT, reflection TEXT, insight TEXT, mood TEXT, created_at TEXT DEFAULT(datetime('now')));
CREATE TABLE inner_state(key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT(datetime('now')));
CREATE TABLE trinity_skills (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, category TEXT DEFAULT 'general', type TEXT DEFAULT 'tool', config TEXT, handler TEXT, enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE trinity_connections (id TEXT PRIMARY KEY, name TEXT NOT NULL, service TEXT NOT NULL, type TEXT DEFAULT 'api', config TEXT, status TEXT DEFAULT 'disconnected', capabilities TEXT, last_sync TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE trinity_development (id TEXT PRIMARY KEY, skill_id TEXT, proposal TEXT, status TEXT DEFAULT 'proposed', sandbox_result TEXT, approved_by TEXT, created_at TEXT DEFAULT (datetime('now')), evaluated_at TEXT, deployed_at TEXT);
CREATE TABLE trinity_skill_executions (id INTEGER PRIMARY KEY AUTOINCREMENT, skill_id TEXT NOT NULL, input TEXT, output TEXT, status TEXT DEFAULT 'pending', duration_ms INTEGER, error TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT,
  project_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT,
  size INTEGER DEFAULT 0,
  type TEXT,
  project_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE timeline (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  category TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE cf_integrations (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  status TEXT DEFAULT 'inactive',
  config TEXT,
  last_sync TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE ops_agents (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, cluster TEXT NOT NULL, role TEXT NOT NULL,
 tools TEXT NOT NULL, version TEXT NOT NULL DEFAULT '6.1.0'
);
CREATE TABLE ops_jobs (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL, task TEXT NOT NULL, team TEXT NOT NULL,
 provider TEXT NOT NULL DEFAULT 'workers-ai', status TEXT NOT NULL DEFAULT 'queued',
 result TEXT, error TEXT, artifact_key TEXT, idempotency_key TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, context_summary TEXT, language TEXT NOT NULL DEFAULT 'sk', intent TEXT NOT NULL DEFAULT 'conversation', risk_level TEXT NOT NULL DEFAULT 'low', plan_json TEXT NOT NULL DEFAULT '[]', owner_mode INTEGER NOT NULL DEFAULT 0);
CREATE TABLE ops_steps (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL, position INTEGER NOT NULL, agent_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', result TEXT, model TEXT, tool_log TEXT,
 duration_ms INTEGER, error TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(job_id, position), FOREIGN KEY(job_id) REFERENCES ops_jobs(id)
);
CREATE TABLE ops_memory (
 key TEXT PRIMARY KEY, value TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'user',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT, action TEXT NOT NULL,
 details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_sessions (
 token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
, email TEXT);
CREATE TABLE ops_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE memories (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      embedding TEXT,
      importance INTEGER DEFAULT 5,
      access_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      metadata TEXT
    );
CREATE TABLE memory_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
    );
CREATE TABLE ops_login_tickets (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, email TEXT);
CREATE TABLE ops_plugins (id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT (datetime('now')), version TEXT NOT NULL DEFAULT '1.0.0', installed INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'trinity-core', installed_at TEXT);
CREATE TABLE ops_roadmap (
 step INTEGER PRIMARY KEY,
 name TEXT NOT NULL,
 status TEXT NOT NULL,
 evidence TEXT,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_studio_projects (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 name TEXT NOT NULL,
 prompt TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ready',
 version INTEGER NOT NULL DEFAULT 1,
 html_key TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_studio_versions (
 project_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 prompt TEXT NOT NULL,
 html_key TEXT NOT NULL,
 model TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(project_id,version),
 FOREIGN KEY(project_id) REFERENCES ops_studio_projects(id)
);
CREATE TABLE ops_users (
 email TEXT PRIMARY KEY COLLATE NOCASE,
 google_sub TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','rejected','blocked')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 approved_at TEXT,
 approved_by TEXT
);
CREATE TABLE ops_oauth_states (
 state_hash TEXT PRIMARY KEY,
 nonce TEXT NOT NULL,
 code_verifier TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE ops_control(
 id INTEGER PRIMARY KEY CHECK(id=1),
 emergency_stop INTEGER NOT NULL DEFAULT 0 CHECK(emergency_stop IN (0,1)),
 reason TEXT,
 updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_api_definitions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'GET' CHECK(method IN ('GET','POST')),
  response_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id,slug)
);
CREATE TABLE ops_api_invocations (
  id TEXT PRIMARY KEY,
  api_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  request_method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(api_id) REFERENCES ops_api_definitions(id) ON DELETE CASCADE
);
CREATE TABLE trading_portfolios (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'EUR', starting_cash_cents INTEGER NOT NULL CHECK(starting_cash_cents >= 0),
  max_position_pct INTEGER NOT NULL DEFAULT 20 CHECK(max_position_pct BETWEEN 1 AND 100),
  max_drawdown_pct INTEGER NOT NULL DEFAULT 15 CHECK(max_drawdown_pct BETWEEN 1 AND 100),
  paper_only INTEGER NOT NULL DEFAULT 1 CHECK(paper_only = 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE trading_transactions (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL, owner_id TEXT NOT NULL, symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('stock','etf','crypto','bond','commodity','forex','other')),
  side TEXT NOT NULL CHECK(side IN ('buy','sell')), quantity_micros INTEGER NOT NULL CHECK(quantity_micros > 0),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0), fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(fee_cents >= 0),
  executed_at TEXT NOT NULL, thesis TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(portfolio_id) REFERENCES trading_portfolios(id) ON DELETE CASCADE
);
CREATE TABLE trading_quotes (
  owner_id TEXT NOT NULL, symbol TEXT NOT NULL, currency TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0), as_of TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(owner_id,symbol,currency)
);
CREATE TABLE trading_journal (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL, owner_id TEXT NOT NULL, title TEXT NOT NULL,
  thesis TEXT NOT NULL, risks TEXT NOT NULL DEFAULT '', lesson TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(portfolio_id) REFERENCES trading_portfolios(id) ON DELETE CASCADE
);
CREATE TABLE ops_api_access_keys (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60 CHECK(rate_limit_per_minute BETWEEN 1 AND 600),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT
);
CREATE TABLE ops_api_key_usage (
  key_id TEXT NOT NULL,
  minute_window INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(key_id,minute_window),
  FOREIGN KEY(key_id) REFERENCES ops_api_access_keys(id) ON DELETE CASCADE
);
CREATE TABLE wallet_accounts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Trinity Wallet Sandbox',
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents>=0),
  mode TEXT NOT NULL DEFAULT 'sandbox' CHECK(mode='sandbox'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('deposit','withdrawal','send')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
  balance_after_cents INTEGER NOT NULL CHECK(balance_after_cents>=0),
  recipient TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'simulated' CHECK(status='simulated'),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(wallet_id) REFERENCES wallet_accounts(id) ON DELETE CASCADE
);
CREATE TABLE ops_system_actions (
 id TEXT PRIMARY KEY,
 action TEXT NOT NULL CHECK(action IN ('read','write','edit','selfwrite','run','deploy','share','upload','upgrade','screenshot','open_app','notify','system_info','scrape','web_fetch','download','git_commit','git_pr')),
 payload_json TEXT NOT NULL,
 rationale TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('proposed','approved','claimed','completed','failed','rejected','expired')),
 requested_by TEXT NOT NULL,
 approved_by TEXT,
 approved_at INTEGER,
 claimed_by TEXT,
 lease_until INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 receipt_json TEXT,
 error TEXT,
 expires_at INTEGER NOT NULL,
 completed_at INTEGER,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_ci_audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  repo TEXT NOT NULL,
  sha TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','success','failure','cancelled','blocked','approved','deployed')),
  trigger TEXT NOT NULL,
  actor TEXT,
  branch TEXT,
  environment TEXT CHECK(environment IS NULL OR environment IN ('staging','production','development')),
  duration_ms INTEGER CHECK(duration_ms IS NULL OR duration_ms >= 0),
  ts TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE
);
CREATE TABLE ops_role_permissions (
  role TEXT NOT NULL CHECK(role IN ('owner','admin','user')),
  capability TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 0 CHECK(allowed IN (0,1)),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(role, capability)
);
CREATE TABLE ops_visual_workflows (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_incidents (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('info','warning','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  title TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details TEXT
);
CREATE TABLE copilot_sessions (
  session_id TEXT PRIMARY KEY,
  history TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE managed_domains (
  id TEXT PRIMARY KEY,
  domain_name TEXT NOT NULL UNIQUE,
  zone_id TEXT,
  registrar TEXT DEFAULT 'cloudflare',
  status TEXT NOT NULL DEFAULT 'active',
  auto_renew INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  nameservers_json TEXT,
  dns_records_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  listing_type TEXT NOT NULL DEFAULT 'none',
  sale_price REAL,
  sale_currency TEXT NOT NULL DEFAULT 'EUR',
  lease_price_monthly REAL,
  lease_currency TEXT NOT NULL DEFAULT 'EUR',
  current_tenant TEXT,
  lease_starts_at TEXT,
  lease_expires_at TEXT,
  buyer TEXT,
  sold_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE domain_dns_records (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES managed_domains(id) ON DELETE CASCADE,
  record_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 1,
  proxied INTEGER NOT NULL DEFAULT 1,
  priority INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE domain_transactions (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES managed_domains(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  party TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE trinity_commands (
  cmd_name TEXT PRIMARY KEY,
  instructions TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "self_improvement_proposals" (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('plugin_install','code_improvement','deployment','behavior_rule')),
  plugin_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected')),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_artifacts (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_shared_notes (
 id TEXT PRIMARY KEY,
 text TEXT NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_multimedia_creations (
        id TEXT PRIMARY KEY,
        media_type TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        style TEXT,
        artifact_id TEXT,
        url TEXT NOT NULL,
        download_url TEXT,
        secondary_url TEXT,
        meta_json TEXT DEFAULT '{}',
        created_by TEXT DEFAULT 'trinity',
        created_at TEXT NOT NULL
      );
CREATE TABLE ops_wallet_terminals (
      owner_id TEXT PRIMARY KEY, iban TEXT, bic TEXT, account_name TEXT, revolut_handle TEXT, paypal_email TEXT,
      crypto_address TEXT, crypto_network TEXT DEFAULT 'polygon', default_terminal TEXT DEFAULT 'sepa',
      updated_at TEXT DEFAULT (datetime('now')), ton_address TEXT);
CREATE TABLE ops_terminal_charges_v2 (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
      purpose TEXT NOT NULL, variable_symbol TEXT, terminal_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      payer_name TEXT, crypto_chain TEXT, crypto_units TEXT, crypto_start_block INTEGER, fx_rate REAL, fx_date TEXT,
      evidence_type TEXT, evidence_ref TEXT, confirmed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE ops_terminal_payouts_v2 (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
      destination_type TEXT NOT NULL, target TEXT NOT NULL, recipient_name TEXT, note TEXT, reference TEXT,
      status TEXT NOT NULL DEFAULT 'prepared', evidence_ref TEXT, confirmed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE ops_wallet_ledger (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR', channel TEXT, ref_id TEXT, evidence_type TEXT NOT NULL, evidence_ref TEXT NOT NULL,
      note TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(evidence_type, evidence_ref));
CREATE TABLE graph_memory_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'project', 'domain', 'note', 'transaction', 'entity', 'topic'
  label TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE graph_memory_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES graph_memory_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES graph_memory_nodes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL, -- 'belongs_to', 'manages', 'hosts', 'transacted', 'relates_to', 'depends_on'
  weight REAL NOT NULL DEFAULT 1.0,
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE studio_code_reviews (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  score_performance INTEGER NOT NULL DEFAULT 95,
  score_accessibility INTEGER NOT NULL DEFAULT 95,
  score_best_practices INTEGER NOT NULL DEFAULT 100,
  score_seo INTEGER NOT NULL DEFAULT 95,
  issues_json TEXT NOT NULL DEFAULT '[]',
  passed_checks_json TEXT NOT NULL DEFAULT '[]',
  generated_tests_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE domain_escrow_deals (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  deal_type TEXT NOT NULL, -- 'instant_buy', 'lease_to_own', 'make_offer'
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  buyer_email TEXT,
  buyer_notes TEXT,
  target_dns TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'settled', 'cancelled'
  payment_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at TEXT
);
CREATE TABLE domain_health_alerts (
  id TEXT PRIMARY KEY,
  domain_name TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'domain_expiry', 'ssl_expiry', 'worker_outage'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  days_remaining INTEGER,
  telegram_sent INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE TABLE commodity_price_alerts (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  condition TEXT NOT NULL, -- 'above', 'below', 'cross_support', 'cross_resistance'
  target_price REAL NOT NULL,
  current_price REAL,
  support_level REAL,
  resistance_level REAL,
  notify_channel TEXT NOT NULL DEFAULT 'telegram',
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'triggered', 'muted'
  triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE generated_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  amount_eur REAL NOT NULL,
  variable_symbol TEXT,
  item_description TEXT NOT NULL,
  iban TEXT NOT NULL,
  bic TEXT,
  qr_svg TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid', 'cancelled'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE TABLE user_passkeys (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  friendly_name TEXT,
  transports TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE TABLE ops_passkey_challenges (
  challenge_hash TEXT PRIMARY KEY,
  user_email TEXT,
  type TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_crypto_balances (
  owner_id TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_name TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0.0,
  staked REAL NOT NULL DEFAULT 0.0,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'polygon',
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (owner_id, token_symbol)
);
CREATE TABLE ops_crypto_transactions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  type TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  amount REAL NOT NULL,
  from_address TEXT,
  to_address TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE ops_chat_incidents (
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  resolution TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (job_id,kind)
);
CREATE TABLE core_agent_runs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  input_hash TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  max_steps INTEGER NOT NULL DEFAULT 4 CHECK(max_steps BETWEEN 1 AND 5),
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed')),
  answer TEXT,
  error TEXT,
  model TEXT,
  usage_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE core_tool_receipts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES core_agent_runs(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  tool TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('completed','failed')),
  receipt_id TEXT NOT NULL UNIQUE,
  input_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id,step)
);
CREATE TABLE core_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE core_personality (
  trait TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE core_thoughts (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  output TEXT NOT NULL,
  model TEXT NOT NULL,
  usage_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE core_reflections (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  insight TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE core_brain_state (
  component TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  last_active TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ops_custom_agents (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, role TEXT NOT NULL, model TEXT NOT NULL, system_prompt TEXT NOT NULL, temperature REAL DEFAULT 0.7, tools_json TEXT DEFAULT '[]', autonomous_mode INTEGER DEFAULT 1, domain_binding TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE meta_oauth_transactions (
 state_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL, session_hash TEXT NOT NULL,
 redirect_uri TEXT NOT NULL, config_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE meta_connections (
 owner_id TEXT PRIMARY KEY, secret_id TEXT NOT NULL, account_id TEXT NOT NULL,
 config_hash TEXT NOT NULL,
 account_name TEXT NOT NULL, scopes_json TEXT NOT NULL, pages_json TEXT NOT NULL,
 expires_at INTEGER, verified_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'connected_read_only'
);
CREATE TABLE ops_sovereign_ledger_v3 (
  block_index INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  block_hash TEXT NOT NULL UNIQUE,
  rollback_ref TEXT,
  receipt TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE ops_truth_assertions (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  evidence_receipt TEXT NOT NULL,
  exit_code INTEGER,
  stdout_hash TEXT,
  stderr_hash TEXT,
  block_hash TEXT,
  verified_at TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE ops_code_provenance (
  provenance_hash TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  git_commit_sha TEXT NOT NULL,
  author_did TEXT NOT NULL,
  reason TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  machine_fingerprint TEXT NOT NULL,
  ast_hash TEXT,
  recorded_at TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE ops_state_replay (
  execution_id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  state_snapshot_json TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result_hash TEXT NOT NULL,
  provenance_hash TEXT,
  receipt TEXT NOT NULL,
  replayed_at TEXT,
  replay_match INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE ops_consumed_nonces (
  nonce TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  operation TEXT NOT NULL,
  diff_sha256 TEXT NOT NULL,
  consumed_at TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS "ops_secret_vault" (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  secret_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stored' CHECK(status IN ('stored','verified','failed','revoked')),
  verification_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_verified_at TEXT,
  revoked_at TEXT,
  UNIQUE(owner_id,provider,name)
);
CREATE TABLE IF NOT EXISTS "ops_ai_provider_settings" (
  owner_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  secret_id TEXT NOT NULL,
  model TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  project_control INTEGER NOT NULL DEFAULT 0 CHECK(project_control IN (0,1)),
  PRIMARY KEY(owner_id,provider),
  FOREIGN KEY(secret_id) REFERENCES ops_secret_vault(id)
);
CREATE TABLE sovereign_policies (
  policy_id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  severity TEXT NOT NULL DEFAULT 'error' CHECK(severity IN ('error','warn','audit')),
  rule_json TEXT NOT NULL,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE TABLE agent_heartbeats (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  active_jobs INTEGER DEFAULT 0,
  cpu_load REAL DEFAULT 0.0,
  memory_load REAL DEFAULT 0.0,
  latency_ms INTEGER DEFAULT 0,
  timestamp INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
);
CREATE TABLE capabilities (
  capability_id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,            -- 'os', 'memory', 'workflow', 'audit', 'security', 'llm', 'copilot', 'mcp', 'pc', 'finance', 'deployment', 'architecture', 'engineering', 'incident'
  critical INTEGER DEFAULT 0 CHECK(critical IN (0,1)),
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE TABLE agent_capabilities (
  agent_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  priority INTEGER DEFAULT 100,
  PRIMARY KEY (agent_id, capability_id),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY(capability_id) REFERENCES capabilities(capability_id)
);
CREATE TABLE agent_dependencies (
  agent_id TEXT NOT NULL,
  depends_on_agent_id TEXT NOT NULL,
  critical INTEGER DEFAULT 1 CHECK(critical IN (0,1)),
  PRIMARY KEY (agent_id, depends_on_agent_id),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY(depends_on_agent_id) REFERENCES agents(agent_id)
);
CREATE TABLE agent_leases (
  lease_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
  FOREIGN KEY(job_id) REFERENCES ops_jobs(id)
);
CREATE TABLE resource_state (
  resource_id TEXT PRIMARY KEY,
  node_name TEXT NOT NULL,
  cpu_score REAL DEFAULT 0.0,
  memory_score REAL DEFAULT 0.0,
  queue_depth INTEGER DEFAULT 0,
  active_jobs INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'edge' CHECK(tier IN ('edge','workstation','cloud','gpu')),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE TABLE kg_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                -- 'project', 'agent', 'capability', 'artifact', 'model', 'user'
  name TEXT NOT NULL,
  properties_json TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE TABLE kg_relations (
  id TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,        -- 'controls', 'depends_on', 'has_capability', 'produced', 'audited_by'
  weight REAL DEFAULT 1.0,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(source_entity_id) REFERENCES kg_entities(id),
  FOREIGN KEY(target_entity_id) REFERENCES kg_entities(id)
);
CREATE TABLE kg_observations (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  observation TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  timestamp INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(entity_id) REFERENCES kg_entities(id)
);
CREATE TABLE kg_evidence (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  proof_json TEXT,
  verified INTEGER DEFAULT 1 CHECK(verified IN (0,1)),
  timestamp INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(observation_id) REFERENCES kg_observations(id)
);
CREATE TABLE kg_decisions (
  id TEXT PRIMARY KEY,
  rationale TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_agent_id TEXT NOT NULL,
  outcome TEXT,
  timestamp INTEGER DEFAULT (unixepoch() * 1000)
);
CREATE TABLE agent_reputation (
  agent_id TEXT PRIMARY KEY,
  completed_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0.0,
  uptime_ratio REAL DEFAULT 1.0,
  audit_score REAL DEFAULT 1.0,
  trust_score REAL DEFAULT 1.0,
  last_evaluated INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
);
CREATE TABLE sovereign_events (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','delivered','failed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at INTEGER NOT NULL,
  delivered_at INTEGER,
  error TEXT
);
CREATE TABLE sovereign_ledger (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  agent TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'AGENT',
  event_type TEXT,
  type TEXT,
  status TEXT NOT NULL CHECK(status IN ('planned','running','completed','failed','acknowledged')),
  task_id TEXT,
  task TEXT,
  claim_id TEXT,
  parent_id TEXT,
  message TEXT,
  evidence TEXT,
  metadata_json TEXT,
  principal TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  input_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE ops_assistant_bridge_notes (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 8000),
  source TEXT NOT NULL CHECK(source IN ('chatgpt','copilot')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (owner_id,id)
);
CREATE TABLE agent_status (
        agent TEXT PRIMARY KEY,
        url TEXT,
        status TEXT NOT NULL,
        latency_ms INTEGER DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        error_details TEXT
      );
CREATE TABLE truth_violations (
        id TEXT PRIMARY KEY,
        memory_id TEXT,
        agent TEXT,
        claim TEXT,
        reason TEXT,
        severity TEXT,
        r2_evidence_key TEXT,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
DELETE FROM sqlite_sequence;
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_memory_type ON memory(memory_type);
CREATE INDEX idx_memory_importance ON memory(importance DESC);
CREATE INDEX idx_thoughts_type ON thoughts(thought_type);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_local_tasks_device ON local_tasks(device_id);
CREATE INDEX idx_local_tasks_status ON local_tasks(status);
CREATE INDEX idx_sync_state_device ON sync_state(device_id);
CREATE INDEX idx_local_audit_device ON local_audit_log(device_id);
CREATE INDEX idx_local_files_device ON local_files(device_id);
CREATE INDEX idx_local_files_project ON local_files(project_id);
CREATE INDEX idx_skills_cat ON trinity_skills(category);
CREATE INDEX idx_skills_en ON trinity_skills(enabled);
CREATE INDEX idx_conn_status ON trinity_connections(status);
CREATE INDEX idx_exec_skill ON trinity_skill_executions(skill_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_timeline_created ON timeline(created_at);
CREATE INDEX idx_messages_conversation_created
ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_updated
ON conversations(updated_at);
CREATE INDEX idx_tasks_project_status
ON tasks(project_id, status);
CREATE INDEX idx_notes_project_created
ON notes(project_id, created_at);
CREATE INDEX idx_audit_created
ON audit_log(created_at);
CREATE INDEX idx_devices_last_seen
ON devices(last_seen);
CREATE INDEX idx_ops_jobs_created ON ops_jobs(created_at);
CREATE INDEX idx_ops_jobs_session ON ops_jobs(session_id, created_at);
CREATE INDEX idx_ops_steps_job ON ops_steps(job_id, position);
CREATE INDEX idx_memories_agent ON memories(agent);
CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_memory_index_keyword ON memory_index(keyword);
CREATE INDEX idx_studio_projects_owner ON ops_studio_projects(owner_id,updated_at);
CREATE INDEX idx_ops_sessions_email ON ops_sessions(email);
CREATE INDEX idx_ops_users_status ON ops_users(status,created_at);
CREATE INDEX idx_ops_jobs_intent ON ops_jobs(intent,risk_level,created_at);
CREATE INDEX idx_ops_jobs_owner ON ops_jobs(owner_mode,created_at);
CREATE INDEX idx_api_definitions_owner_updated ON ops_api_definitions(owner_id,updated_at DESC);
CREATE INDEX idx_api_invocations_api_created ON ops_api_invocations(api_id,created_at DESC);
CREATE INDEX idx_trading_portfolios_owner ON trading_portfolios(owner_id,updated_at DESC);
CREATE INDEX idx_trading_transactions_portfolio_time ON trading_transactions(portfolio_id,executed_at,id);
CREATE INDEX idx_trading_transactions_owner_symbol ON trading_transactions(owner_id,symbol);
CREATE INDEX idx_trading_journal_portfolio ON trading_journal(portfolio_id,updated_at DESC);
CREATE INDEX idx_api_access_keys_owner ON ops_api_access_keys(owner_id,created_at DESC);
CREATE INDEX idx_wallet_transactions_owner ON wallet_transactions(owner_id,created_at DESC);
CREATE INDEX idx_system_actions_queue ON ops_system_actions(status,expires_at,created_at);
CREATE INDEX idx_memory_long_importance
ON memory_long(importance DESC);
CREATE INDEX idx_ops_ci_audit_repo_ts ON ops_ci_audit_log(repo, ts DESC);
CREATE INDEX idx_ops_ci_audit_sha ON ops_ci_audit_log(sha);
CREATE INDEX idx_ops_ci_audit_ts ON ops_ci_audit_log(ts DESC);
CREATE INDEX idx_ops_visual_workflows_owner
ON ops_visual_workflows(owner_id, updated_at DESC);
CREATE INDEX idx_ops_incidents_status
ON ops_incidents(status, created_at DESC);
CREATE INDEX idx_audit_timestamp ON audit(timestamp);
CREATE INDEX idx_audit_level ON audit(level);
CREATE INDEX idx_copilot_sessions_updated ON copilot_sessions(updated_at);
CREATE INDEX idx_managed_domains_status ON managed_domains(status);
CREATE INDEX idx_managed_domains_name ON managed_domains(domain_name);
CREATE INDEX idx_managed_domains_listing ON managed_domains(listing_type);
CREATE INDEX idx_domain_dns_domain_id ON domain_dns_records(domain_id);
CREATE INDEX idx_domain_dns_name_type ON domain_dns_records(domain_id, name, type);
CREATE INDEX idx_domain_transactions_domain_id ON domain_transactions(domain_id);
CREATE INDEX idx_domain_transactions_type ON domain_transactions(type);
CREATE INDEX idx_trinity_commands_created ON trinity_commands(created_at);
CREATE INDEX idx_self_improvement_status_created
  ON self_improvement_proposals(status, created_at DESC);
CREATE INDEX idx_ops_artifacts_created_at ON ops_artifacts(created_at DESC);
CREATE INDEX idx_ops_artifacts_filename ON ops_artifacts(filename);
CREATE INDEX idx_graph_nodes_type ON graph_memory_nodes(type);
CREATE INDEX idx_graph_edges_source ON graph_memory_edges(source_id);
CREATE INDEX idx_graph_edges_target ON graph_memory_edges(target_id);
CREATE INDEX idx_graph_edges_rel ON graph_memory_edges(relationship);
CREATE INDEX idx_studio_reviews_proj ON studio_code_reviews(project_id);
CREATE INDEX idx_escrow_deals_domain ON domain_escrow_deals(domain_name);
CREATE INDEX idx_escrow_deals_status ON domain_escrow_deals(status);
CREATE INDEX idx_health_alerts_domain ON domain_health_alerts(domain_name);
CREATE INDEX idx_health_alerts_resolved ON domain_health_alerts(resolved);
CREATE INDEX idx_price_alerts_symbol ON commodity_price_alerts(symbol);
CREATE INDEX idx_price_alerts_status ON commodity_price_alerts(status);
CREATE INDEX idx_invoices_status ON generated_invoices(status);
CREATE INDEX idx_user_passkeys_email ON user_passkeys(user_email);
CREATE INDEX idx_user_passkeys_cred ON user_passkeys(credential_id);
CREATE INDEX idx_passkey_challenges_expires ON ops_passkey_challenges(expires_at);
CREATE INDEX idx_ops_events_action ON ops_events(action);
CREATE INDEX idx_ops_events_created ON ops_events(created_at);
CREATE INDEX idx_core_tool_receipts_run ON core_tool_receipts(run_id,step);
CREATE INDEX idx_slv3_actor ON ops_sovereign_ledger_v3(actor, timestamp);
CREATE INDEX idx_slv3_action ON ops_sovereign_ledger_v3(action, timestamp);
CREATE INDEX idx_slv3_block_hash ON ops_sovereign_ledger_v3(block_hash);
CREATE INDEX idx_truth_action ON ops_truth_assertions(action, verified_at);
CREATE INDEX idx_prov_file ON ops_code_provenance(file_path, git_commit_sha);
CREATE INDEX idx_replay_exec ON ops_state_replay(execution_id);
CREATE INDEX idx_secret_vault_owner ON ops_secret_vault(owner_id,created_at DESC);
CREATE UNIQUE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agent_heartbeats ON agent_heartbeats(agent_id, timestamp DESC);
CREATE INDEX idx_capabilities_category ON capabilities(category);
CREATE INDEX idx_agent_leases_expires ON agent_leases(expires_at);
CREATE INDEX idx_kg_entities_type ON kg_entities(type, name);
CREATE INDEX idx_kg_relations_src ON kg_relations(source_entity_id, relation_type);
CREATE INDEX idx_kg_relations_tgt ON kg_relations(target_entity_id, relation_type);
CREATE INDEX idx_sovereign_events_pending ON sovereign_events(delivery_status,occurred_at);
CREATE INDEX idx_sovereign_events_aggregate ON sovereign_events(aggregate_type,aggregate_id,occurred_at);
CREATE INDEX idx_sovereign_ledger_agent ON sovereign_ledger(agent, timestamp);
CREATE INDEX idx_sovereign_ledger_event_type ON sovereign_ledger(event_type, timestamp);
CREATE INDEX idx_sovereign_ledger_type ON sovereign_ledger(type, timestamp);
CREATE INDEX idx_sovereign_ledger_status ON sovereign_ledger(status, timestamp);
CREATE INDEX idx_sovereign_ledger_task ON sovereign_ledger(task_id, timestamp);
CREATE INDEX idx_sovereign_ledger_principal ON sovereign_ledger(principal, timestamp);
CREATE INDEX idx_assistant_bridge_owner_updated
ON ops_assistant_bridge_notes(owner_id,updated_at DESC);
CREATE TRIGGER slv3_no_update BEFORE UPDATE ON ops_sovereign_ledger_v3 BEGIN SELECT RAISE(ABORT, 'ops_sovereign_ledger_v3 is strictly append-only'); END;
CREATE TRIGGER slv3_no_delete BEFORE DELETE ON ops_sovereign_ledger_v3 BEGIN SELECT RAISE(ABORT, 'ops_sovereign_ledger_v3 is strictly append-only'); END;
CREATE TRIGGER nonces_no_update BEFORE UPDATE ON ops_consumed_nonces BEGIN SELECT RAISE(ABORT, 'ops_consumed_nonces is strictly immutable'); END;
CREATE TRIGGER nonces_no_delete BEFORE DELETE ON ops_consumed_nonces BEGIN SELECT RAISE(ABORT, 'ops_consumed_nonces is strictly append-only'); END;
CREATE TRIGGER sovereign_ledger_no_update BEFORE UPDATE ON sovereign_ledger BEGIN SELECT RAISE(ABORT, 'sovereign_ledger is append-only'); END;
CREATE TRIGGER sovereign_ledger_no_delete BEFORE DELETE ON sovereign_ledger BEGIN SELECT RAISE(ABORT, 'sovereign_ledger is append-only'); END;

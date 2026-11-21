-- ═══════════════════════════════════════════════════════════════════════
-- Trinity Tool-Calling Schema Migration
-- Run against: trinity-v03 (D1 database ca8ea24e-f7db-431e-b8bf-97f713ae4533)
-- ═══════════════════════════════════════════════════════════════════════

-- core_tool_receipts already exists — verify/extend columns
-- (Safe to run: uses INSERT OR IGNORE / CREATE TABLE IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS core_tool_receipts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id       TEXT NOT NULL UNIQUE,
  tool_name     TEXT NOT NULL,
  executor      TEXT NOT NULL,        -- 'pc_bridge' | 'browser' | 'd1' | 'kv'
  action        TEXT NOT NULL,
  arguments     TEXT,                  -- JSON string
  status        TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | SUCCESS | ERROR | OFFLINE
  result        TEXT,                  -- JSON string
  user_id       TEXT,
  session_id    TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  completed_at  TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_receipts_session ON core_tool_receipts(session_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON core_tool_receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON core_tool_receipts(created_at);

-- ── Tool Registry: seed known tools ──────────────────────────────────
-- trinity_tool_registry already exists — insert tool definitions

INSERT OR IGNORE INTO trinity_tool_registry (name, executor, action, description, enabled) VALUES
  ('pc_open_file',   'pc_bridge', 'open_file',  'Open a file on the user PC with default app or editor', 1),
  ('pc_execute',     'pc_bridge', 'execute',    'Run an allowlisted command on the user PC',            1),
  ('pc_list_dir',    'pc_bridge', 'list_dir',   'List directory contents on the user PC',               1),
  ('pc_read_file',   'pc_bridge', 'read_file',  'Read file contents from the user PC',                   1),
  ('pc_write_file',  'pc_bridge', 'write_file', 'Write content to a file on the user PC',                1),
  ('pc_create_dir',  'pc_bridge', 'create_dir',  'Create a directory on the user PC',                     1),
  ('pc_run_build',   'pc_bridge', 'run_build',   'Run a build command (npm/pnpm/yarn) on the user PC',   1),
  ('browser_navigate',   'browser', 'navigate',   'Navigate to a URL in headless Chromium',              1),
  ('browser_screenshot', 'browser', 'screenshot', 'Capture a screenshot and store in R2',                 1),
  ('browser_scrape',     'browser', 'scrape',     'Scrape visible text content from a page',             1),
  ('browser_extract',    'browser', 'extract',    'Extract structured data via CSS selector',            1),
  ('browser_fill_form',  'browser', 'fill_form',  'Fill and optionally submit a form',                    1),
  ('browser_click',      'browser', 'click',      'Click an element on a page',                           1),
  ('db_query',       'd1', 'query',   'Run a SELECT query against D1',   1),
  ('db_execute',     'd1', 'execute', 'Run an INSERT/UPDATE/DELETE on D1', 1),
  ('kv_get',         'kv', 'get',    'Get a value from KV',              1),
  ('kv_put',         'kv', 'put',    'Put a value into KV',              1);

-- ── Verify tables ────────────────────────────────────────────────────
-- SELECT * FROM trinity_tool_registry WHERE enabled = 1;
-- SELECT * FROM core_tool_receipts ORDER BY created_at DESC LIMIT 10;

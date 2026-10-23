-- Scoped shared notes for independently authenticated ChatGPT and Copilot clients.
-- This is not a mirror of either provider's private conversation history.
CREATE TABLE IF NOT EXISTS ops_assistant_bridge_notes (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 8000),
  source TEXT NOT NULL CHECK(source IN ('chatgpt','copilot')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (owner_id,id)
);
CREATE INDEX IF NOT EXISTS idx_assistant_bridge_owner_updated
ON ops_assistant_bridge_notes(owner_id,updated_at DESC);

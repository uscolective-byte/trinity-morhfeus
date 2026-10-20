-- Trinity Commands (Learned Skills & Custom Prompts)
CREATE TABLE IF NOT EXISTS trinity_commands (
  cmd_name TEXT PRIMARY KEY,
  instructions TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trinity_commands_created ON trinity_commands(created_at);

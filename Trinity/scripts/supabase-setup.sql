-- ═══════════════════════════════════════════════════════
-- Supabase migrácia pre Trinity integráciu
-- Spusti cez Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Povolenie pgvector (raz za projekt)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Audit log akcií z PC Bridge ──
CREATE TABLE IF NOT EXISTS trinity_actions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action      TEXT NOT NULL,
  path        TEXT,
  rationale   TEXT,
  receipt     JSONB,
  hostname    TEXT,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trinity_actions_action    ON trinity_actions(action);
CREATE INDEX IF NOT EXISTS idx_trinity_actions_timestamp ON trinity_actions(timestamp DESC);

-- ── Vektorová pamäť pre RAG ──
CREATE TABLE IF NOT EXISTS trinity_memory_vectors (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content     TEXT NOT NULL,
  source      TEXT,
  category    TEXT DEFAULT 'general',
  embedding   VECTOR(1536),  -- OpenAI text-embedding-3-small / Gemini embedding
  metadata    JSONB DEFAULT '{}',
  importance  FLOAT DEFAULT 0.5,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trinity_memory_category ON trinity_memory_vectors(category);
-- IVFFlat index pre vector search (aktivovať po vložení dát)
-- CREATE INDEX ON trinity_memory_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Funkcia pre sémantické vyhľadávanie
CREATE OR REPLACE FUNCTION search_trinity_memory(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count     INT   DEFAULT 10
)
RETURNS TABLE (
  id         UUID,
  content    TEXT,
  source     TEXT,
  category   TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT id, content, source, category,
         1 - (embedding <=> query_embedding) AS similarity
  FROM   trinity_memory_vectors
  WHERE  1 - (embedding <=> query_embedding) > match_threshold
  ORDER  BY embedding <=> query_embedding
  LIMIT  match_count;
$$;

-- ── Deploy log ──
CREATE TABLE IF NOT EXISTS trinity_deploys (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sha         TEXT,
  ref         TEXT,
  status      TEXT DEFAULT 'pending',
  run_id      TEXT,
  deployed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Trigger pre updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trinity_memory_vectors_updated_at
  BEFORE UPDATE ON trinity_memory_vectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS (Row Level Security) — zapni ak potrebuješ multi-user
-- ALTER TABLE trinity_actions        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE trinity_memory_vectors ENABLE ROW LEVEL SECURITY;

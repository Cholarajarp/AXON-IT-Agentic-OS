-- Code Intelligence Engine Schema
-- Extends the core AXON IT Agentic AI OS schema with code understanding capabilities

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Indexed Files
CREATE TABLE IF NOT EXISTS indexed_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp')),
  content_hash TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  last_modified TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  UNIQUE(workspace_id, file_path, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_indexed_files_workspace ON indexed_files(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_indexed_files_language ON indexed_files(language);
CREATE INDEX IF NOT EXISTS idx_indexed_files_hash ON indexed_files(content_hash);

-- Symbols
CREATE TABLE IF NOT EXISTS symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES indexed_files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('function', 'class', 'interface', 'type', 'variable', 'method', 'property', 'enum', 'namespace')),
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  column_start INTEGER NOT NULL,
  column_end INTEGER NOT NULL,
  documentation TEXT,
  signature TEXT,
  parent_id UUID REFERENCES symbols(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols(type);
CREATE INDEX IF NOT EXISTS idx_symbols_parent ON symbols(parent_id);
CREATE INDEX IF NOT EXISTS idx_symbols_tenant ON symbols(tenant_id);

-- Symbol Edges (relationships between symbols)
CREATE TABLE IF NOT EXISTS symbol_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  to_symbol_id UUID NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('calls', 'imports', 'extends', 'implements', 'uses')),
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_symbol_edges_from ON symbol_edges(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_to ON symbol_edges(to_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_type ON symbol_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_tenant ON symbol_edges(tenant_id);

-- Code Embeddings (for semantic search)
CREATE TABLE IF NOT EXISTS code_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES indexed_files(id) ON DELETE CASCADE,
  symbol_id UUID REFERENCES symbols(id) ON DELETE CASCADE,
  content_snippet TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 embedding dimension
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_embeddings_file ON code_embeddings(file_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_symbol ON code_embeddings(symbol_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_tenant ON code_embeddings(tenant_id);

-- Vector similarity search index (IVFFlat for performance)
CREATE INDEX IF NOT EXISTS idx_code_embeddings_vector
  ON code_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- File Dependencies
CREATE TABLE IF NOT EXISTS file_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES indexed_files(id) ON DELETE CASCADE,
  depends_on_path TEXT NOT NULL,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('import', 'require', 'include')),
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_deps_file ON file_dependencies(file_id);
CREATE INDEX IF NOT EXISTS idx_file_deps_path ON file_dependencies(depends_on_path);
CREATE INDEX IF NOT EXISTS idx_file_deps_tenant ON file_dependencies(tenant_id);

-- Indexing Jobs (track indexing progress)
CREATE TABLE IF NOT EXISTS indexing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  symbols_extracted INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indexing_jobs_workspace ON indexing_jobs(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indexing_jobs(status);

-- Code Patterns (detected architectural patterns)
CREATE TABLE IF NOT EXISTS code_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('architectural', 'design', 'anti-pattern')),
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  description TEXT NOT NULL,
  files TEXT[] NOT NULL DEFAULT '{}',
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_patterns_workspace ON code_patterns(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_code_patterns_type ON code_patterns(type);

-- Search Cache (cache search results for performance)
CREATE TABLE IF NOT EXISTS search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  results JSONB NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_search_cache_workspace ON search_cache(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_search_cache_hash ON search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

-- Cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_search_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM search_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE indexed_files IS 'Stores metadata about indexed source files';
COMMENT ON TABLE symbols IS 'Stores extracted code symbols (functions, classes, etc.)';
COMMENT ON TABLE symbol_edges IS 'Stores relationships between symbols (calls, imports, etc.)';
COMMENT ON TABLE code_embeddings IS 'Stores vector embeddings for semantic code search';
COMMENT ON TABLE file_dependencies IS 'Stores file-level dependency relationships';
COMMENT ON TABLE indexing_jobs IS 'Tracks progress of workspace indexing operations';
COMMENT ON TABLE code_patterns IS 'Stores detected architectural and design patterns';
COMMENT ON TABLE search_cache IS 'Caches search results for performance optimization';

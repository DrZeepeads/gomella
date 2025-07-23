-- Database Schema for Gomella's Book of Pediatric Neonatology
-- This file contains the complete database setup including tables, indexes, and triggers

-- Enable the vector extension (required for pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the main table for storing Gomella's book content
CREATE TABLE IF NOT EXISTS public.gomella_book_of_pediatric (
    id SERIAL NOT NULL,
    text TEXT NOT NULL,
    page_number INTEGER NULL,
    source_file TEXT NULL,
    embedding public.vector NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT gomella_book_of_pediatrics_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Add comments to the table and columns for documentation
COMMENT ON TABLE public.gomella_book_of_pediatric IS 'Stores text content and embeddings from Gomella''s Neonatology book';
COMMENT ON COLUMN public.gomella_book_of_pediatric.id IS 'Primary key, auto-incrementing identifier';
COMMENT ON COLUMN public.gomella_book_of_pediatric.text IS 'Extracted text content from the PDF';
COMMENT ON COLUMN public.gomella_book_of_pediatric.page_number IS 'Page number from the original PDF';
COMMENT ON COLUMN public.gomella_book_of_pediatric.source_file IS 'Name of the source PDF file';
COMMENT ON COLUMN public.gomella_book_of_pediatric.embedding IS 'Vector embedding of the text content';
COMMENT ON COLUMN public.gomella_book_of_pediatric.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN public.gomella_book_of_pediatric.updated_at IS 'Timestamp when the record was last updated';

-- Create indexes for efficient querying

-- 1. Vector similarity search index using IVFFlat
CREATE INDEX IF NOT EXISTS gomella_embeddings_idx 
ON public.gomella_book_of_pediatric 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100) 
TABLESPACE pg_default;

-- 2. Alternative vector index name (as specified in the original request)
CREATE INDEX IF NOT EXISTS idx_gomella_content_embedding 
ON public.gomella_book_of_pediatric 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100) 
TABLESPACE pg_default;

-- 3. Index on page_number for efficient page-based queries
CREATE INDEX IF NOT EXISTS idx_gomella_page_number 
ON public.gomella_book_of_pediatric (page_number)
TABLESPACE pg_default;

-- 4. Index on source_file for filtering by PDF file
CREATE INDEX IF NOT EXISTS idx_gomella_source_file 
ON public.gomella_book_of_pediatric (source_file)
TABLESPACE pg_default;

-- 5. Composite index for page and source file queries
CREATE INDEX IF NOT EXISTS idx_gomella_source_page 
ON public.gomella_book_of_pediatric (source_file, page_number)
TABLESPACE pg_default;

-- 6. Full-text search index on the text content
CREATE INDEX IF NOT EXISTS idx_gomella_text_search 
ON public.gomella_book_of_pediatric 
USING gin(to_tsvector('english', text))
TABLESPACE pg_default;

-- 7. Index on created_at for temporal queries
CREATE INDEX IF NOT EXISTS idx_gomella_created_at 
ON public.gomella_book_of_pediatric (created_at)
TABLESPACE pg_default;

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on record updates
DROP TRIGGER IF EXISTS update_gomella_updated_at ON public.gomella_book_of_pediatric;
CREATE TRIGGER update_gomella_updated_at 
    BEFORE UPDATE ON public.gomella_book_of_pediatric 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view for easier querying with text search capabilities
CREATE OR REPLACE VIEW public.gomella_search_view AS
SELECT 
    id,
    text,
    page_number,
    source_file,
    created_at,
    updated_at,
    to_tsvector('english', text) as text_vector,
    -- Calculate text length for analytics
    length(text) as text_length,
    -- Extract first 100 characters as preview
    left(text, 100) || CASE WHEN length(text) > 100 THEN '...' ELSE '' END as text_preview
FROM public.gomella_book_of_pediatric;

-- Add comment to the view
COMMENT ON VIEW public.gomella_search_view IS 'Enhanced view of gomella_book_of_pediatric with full-text search capabilities and text analytics';

-- Create function for similarity search
CREATE OR REPLACE FUNCTION search_gomella_content(
    query_embedding vector,
    similarity_threshold float DEFAULT 0.7,
    max_results integer DEFAULT 10
)
RETURNS TABLE (
    id integer,
    text text,
    page_number integer,
    source_file text,
    similarity float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.text,
        g.page_number,
        g.source_file,
        1 - (g.embedding <=> query_embedding) as similarity
    FROM public.gomella_book_of_pediatric g
    WHERE g.embedding IS NOT NULL
        AND 1 - (g.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY g.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION search_gomella_content IS 'Performs vector similarity search on Gomella book content';

-- Create function for hybrid search (text + vector)
CREATE OR REPLACE FUNCTION hybrid_search_gomella(
    search_text text,
    query_embedding vector DEFAULT NULL,
    text_weight float DEFAULT 0.5,
    vector_weight float DEFAULT 0.5,
    max_results integer DEFAULT 10
)
RETURNS TABLE (
    id integer,
    text text,
    page_number integer,
    source_file text,
    text_rank float,
    vector_similarity float,
    combined_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.text,
        g.page_number,
        g.source_file,
        ts_rank(to_tsvector('english', g.text), plainto_tsquery('english', search_text)) as text_rank,
        CASE 
            WHEN query_embedding IS NOT NULL AND g.embedding IS NOT NULL 
            THEN 1 - (g.embedding <=> query_embedding)
            ELSE 0.0
        END as vector_similarity,
        (text_weight * ts_rank(to_tsvector('english', g.text), plainto_tsquery('english', search_text))) +
        (vector_weight * CASE 
            WHEN query_embedding IS NOT NULL AND g.embedding IS NOT NULL 
            THEN 1 - (g.embedding <=> query_embedding)
            ELSE 0.0
        END) as combined_score
    FROM public.gomella_book_of_pediatric g
    WHERE to_tsvector('english', g.text) @@ plainto_tsquery('english', search_text)
        OR (query_embedding IS NOT NULL AND g.embedding IS NOT NULL)
    ORDER BY combined_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the hybrid search function
COMMENT ON FUNCTION hybrid_search_gomella IS 'Performs hybrid search combining full-text search and vector similarity';

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.gomella_book_of_pediatric TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE gomella_book_of_pediatric_id_seq TO your_app_user;
-- GRANT SELECT ON public.gomella_search_view TO your_app_user;

-- Create sample queries for testing
/*
-- Example queries to test the setup:

-- 1. Basic text search
SELECT * FROM public.gomella_search_view 
WHERE text_vector @@ plainto_tsquery('english', 'neonatal resuscitation');

-- 2. Vector similarity search (requires actual embedding vector)
SELECT * FROM search_gomella_content('[0.1, 0.2, 0.3, ...]'::vector, 0.7, 5);

-- 3. Hybrid search
SELECT * FROM hybrid_search_gomella('respiratory distress', '[0.1, 0.2, 0.3, ...]'::vector);

-- 4. Page-based queries
SELECT * FROM public.gomella_book_of_pediatric WHERE page_number BETWEEN 100 AND 200;

-- 5. Source file filtering
SELECT * FROM public.gomella_book_of_pediatric WHERE source_file LIKE '%1-737%';

-- 6. Analytics queries
SELECT 
    source_file,
    COUNT(*) as chunk_count,
    AVG(length(text)) as avg_text_length,
    MIN(page_number) as first_page,
    MAX(page_number) as last_page
FROM public.gomella_book_of_pediatric 
GROUP BY source_file;
*/


-- Data Import Script for Gomella's Book of Pediatric Neonatology
-- This script imports the processed CSV data into the PostgreSQL database

-- First, ensure the database schema is set up
-- Run database_schema.sql before executing this script

-- Set client encoding to handle UTF-8 properly
SET client_encoding = 'UTF8';

-- Show current database and user
SELECT current_database(), current_user, version();

-- Check if the table exists
SELECT 
    schemaname, 
    tablename, 
    tableowner 
FROM pg_tables 
WHERE tablename = 'gomella_book_of_pediatric';

-- Check table structure
\d public.gomella_book_of_pediatric

-- Import data from CSV file
-- Note: Adjust the file path as needed for your environment
\echo 'Importing data from gomella_book_data.csv...'

-- Method 1: Using COPY command (recommended for large datasets)
COPY public.gomella_book_of_pediatric(text, page_number, source_file, embedding)
FROM '/path/to/gomella_book_data.csv'
WITH (
    FORMAT csv,
    HEADER true,
    DELIMITER ',',
    QUOTE '"',
    ESCAPE '"',
    NULL ''
);

-- Alternative Method 2: Using \copy (for local files when you don't have superuser privileges)
-- Uncomment the line below and comment out the COPY command above if needed
-- \copy public.gomella_book_of_pediatric(text, page_number, source_file, embedding) FROM 'gomella_book_data.csv' WITH CSV HEADER;

-- Verify the import
\echo 'Verifying data import...'

-- Count total records
SELECT COUNT(*) as total_records FROM public.gomella_book_of_pediatric;

-- Show sample records
SELECT 
    id,
    left(text, 100) || '...' as text_preview,
    page_number,
    source_file,
    created_at
FROM public.gomella_book_of_pediatric 
ORDER BY id 
LIMIT 5;

-- Check data distribution by source file
SELECT 
    source_file,
    COUNT(*) as record_count,
    MIN(page_number) as min_page,
    MAX(page_number) as max_page,
    AVG(length(text)) as avg_text_length
FROM public.gomella_book_of_pediatric 
GROUP BY source_file
ORDER BY source_file;

-- Check for records with embeddings
SELECT 
    COUNT(*) as total_records,
    COUNT(embedding) as records_with_embeddings,
    COUNT(*) - COUNT(embedding) as records_without_embeddings
FROM public.gomella_book_of_pediatric;

-- Verify indexes are created
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'gomella_book_of_pediatric'
ORDER BY indexname;

-- Test full-text search functionality
\echo 'Testing full-text search...'
SELECT 
    id,
    left(text, 150) || '...' as text_preview,
    page_number,
    ts_rank(to_tsvector('english', text), plainto_tsquery('english', 'neonatal')) as rank
FROM public.gomella_book_of_pediatric 
WHERE to_tsvector('english', text) @@ plainto_tsquery('english', 'neonatal')
ORDER BY rank DESC
LIMIT 3;

-- Test the search view
\echo 'Testing search view...'
SELECT 
    id,
    text_preview,
    page_number,
    source_file,
    text_length
FROM public.gomella_search_view
ORDER BY id
LIMIT 3;

-- Performance analysis
\echo 'Analyzing table statistics...'
ANALYZE public.gomella_book_of_pediatric;

-- Show table size and index sizes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'gomella_book_of_pediatric'
ORDER BY attname;

-- Show table and index sizes
SELECT 
    pg_size_pretty(pg_total_relation_size('public.gomella_book_of_pediatric')) as total_size,
    pg_size_pretty(pg_relation_size('public.gomella_book_of_pediatric')) as table_size,
    pg_size_pretty(pg_total_relation_size('public.gomella_book_of_pediatric') - pg_relation_size('public.gomella_book_of_pediatric')) as index_size;

\echo 'Data import and verification completed!'
\echo 'You can now use the search functions and run queries on the data.'

-- Example queries to get started:
\echo 'Example queries:'
\echo '1. Search for specific terms:'
\echo '   SELECT * FROM gomella_search_view WHERE text_vector @@ plainto_tsquery(''english'', ''your_search_term'');'
\echo ''
\echo '2. Find content by page range:'
\echo '   SELECT * FROM gomella_book_of_pediatric WHERE page_number BETWEEN 100 AND 200;'
\echo ''
\echo '3. Vector similarity search (requires embedding vector):'
\echo '   SELECT * FROM search_gomella_content(''[0.1,0.2,0.3,...]''::vector, 0.7, 10);'


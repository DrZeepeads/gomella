# Gomella's Neonatology Book Processing

This repository contains tools to process Gomella's Neonatology Management book PDFs, extract text content, generate embeddings, and create a structured dataset for use with PostgreSQL and vector search capabilities.

## 📁 Repository Contents

- **PDF Files**: Two parts of Gomella's Neonatology 8th Edition (2020)
  - `Gomella's Neonatology Management, Procedures, On-Call Problems, Diseases, and Drugs 8th Edition 2020_1-737.pdf`
  - `Gomella's Neonatology Management, Procedures, On-Call Problems, Diseases, and Drugs 8th Edition 2020_738-end.pdf`

- **Processing Scripts**:
  - `pdf_processor.py` - Main script to extract text and generate embeddings
  - `database_schema.sql` - Complete PostgreSQL schema with indexes and functions
  - `requirements.txt` - Python dependencies

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Process PDF Files

```bash
python pdf_processor.py
```

This will:
- Extract text from both PDF files
- Generate embeddings using sentence-transformers
- Create `gomella_book_data.csv` with the processed data

### 3. Set Up Database

```sql
-- Connect to your PostgreSQL database and run:
\i database_schema.sql
```

### 4. Import Data

```bash
# Import the CSV data into PostgreSQL
psql -d your_database -c "\COPY public.gomella_book_of_pediatric(text, page_number, source_file, embedding) FROM 'gomella_book_data.csv' WITH CSV HEADER;"
```

## 📊 Database Schema

### Table Structure

```sql
CREATE TABLE public.gomella_book_of_pediatric (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    page_number INTEGER,
    source_file TEXT,
    embedding vector,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes

The schema includes several optimized indexes:

1. **Vector Similarity Search**: IVFFlat indexes for fast cosine similarity queries
2. **Page Number Index**: For page-based filtering
3. **Source File Index**: For filtering by PDF file
4. **Full-Text Search**: GIN index for text search
5. **Composite Indexes**: For complex queries

### Search Functions

#### Vector Similarity Search
```sql
SELECT * FROM search_gomella_content(
    query_embedding := '[0.1, 0.2, 0.3, ...]'::vector,
    similarity_threshold := 0.7,
    max_results := 10
);
```

#### Hybrid Search (Text + Vector)
```sql
SELECT * FROM hybrid_search_gomella(
    search_text := 'neonatal resuscitation',
    query_embedding := '[0.1, 0.2, 0.3, ...]'::vector,
    text_weight := 0.5,
    vector_weight := 0.5,
    max_results := 10
);
```

## 🔧 Configuration Options

### PDF Processor Settings

You can customize the processing by modifying these parameters in `pdf_processor.py`:

```python
# Text chunking
max_chunk_size = 1000  # Maximum characters per chunk
overlap = 100          # Overlap between chunks

# Embedding model
model_name = 'all-MiniLM-L6-v2'  # Sentence transformer model
```

### Database Configuration

The schema supports various PostgreSQL configurations:

- **Vector Extension**: Requires `pgvector` extension
- **Tablespace**: Uses `pg_default` (can be customized)
- **Index Parameters**: IVFFlat with 100 lists (adjustable based on data size)

## 📈 Performance Optimization

### Index Tuning

For large datasets, consider adjusting the IVFFlat parameters:

```sql
-- For datasets > 100K records
CREATE INDEX idx_large_dataset ON gomella_book_of_pediatric 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1000);

-- For datasets < 10K records  
CREATE INDEX idx_small_dataset ON gomella_book_of_pediatric 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

### Query Optimization

1. **Use appropriate similarity thresholds** (0.7-0.8 for good matches)
2. **Limit result sets** to avoid large data transfers
3. **Use composite indexes** for multi-column filters
4. **Consider partitioning** for very large datasets

## 🔍 Example Queries

### Basic Text Search
```sql
SELECT text, page_number, source_file 
FROM gomella_search_view 
WHERE text_vector @@ plainto_tsquery('english', 'respiratory distress syndrome')
ORDER BY ts_rank(text_vector, plainto_tsquery('english', 'respiratory distress syndrome')) DESC
LIMIT 10;
```

### Page Range Query
```sql
SELECT * FROM gomella_book_of_pediatric 
WHERE page_number BETWEEN 100 AND 200 
  AND source_file LIKE '%1-737%'
ORDER BY page_number;
```

### Analytics Query
```sql
SELECT 
    source_file,
    COUNT(*) as total_chunks,
    AVG(length(text)) as avg_chunk_length,
    MIN(page_number) as first_page,
    MAX(page_number) as last_page
FROM gomella_book_of_pediatric 
GROUP BY source_file;
```

## 🛠️ Troubleshooting

### Common Issues

1. **PDF Processing Errors**
   - Ensure PDF files are not corrupted
   - Check file permissions
   - Try alternative PDF libraries (PyMuPDF, pdfplumber)

2. **Memory Issues**
   - Reduce `max_chunk_size` for large PDFs
   - Process files individually
   - Use batch processing for embeddings

3. **Database Connection Issues**
   - Verify PostgreSQL connection settings
   - Ensure `pgvector` extension is installed
   - Check user permissions

### Performance Issues

1. **Slow Vector Searches**
   - Increase `lists` parameter in IVFFlat index
   - Use appropriate similarity thresholds
   - Consider using HNSW index for very large datasets

2. **Large CSV Files**
   - Use `COPY` command instead of INSERT statements
   - Consider streaming imports for very large datasets

## 📝 Data Format

### CSV Output Format

The generated CSV file contains the following columns:

| Column | Type | Description |
|--------|------|-------------|
| `text` | TEXT | Extracted text content |
| `page_number` | INTEGER | Page number from PDF |
| `source_file` | TEXT | Source PDF filename |
| `embedding` | JSON | Vector embedding as JSON array |

### Embedding Format

Embeddings are stored as JSON arrays of floating-point numbers:
```json
[0.123, -0.456, 0.789, ..., 0.321]
```

When importing to PostgreSQL, these are converted to the `vector` type.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational and research purposes. Please respect the copyright of the original Gomella's Neonatology textbook.

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the database logs
3. Open an issue in the repository
4. Contact the development team

---

**Note**: This tool is designed for processing medical textbooks for educational and research purposes. Always verify the accuracy of extracted content and consult original sources for clinical decisions.


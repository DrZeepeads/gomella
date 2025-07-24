# 🏥 Gomella Dataset - Prisma Setup Guide

This guide will help you set up and import the Gomella's Neonatology dataset into your Prisma-managed PostgreSQL database.

## 🚀 Quick Start

### 1. **Environment Setup**

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your database URL
# DATABASE_URL="your_prisma_database_url_here"
```

### 2. **Install Dependencies**

```bash
# Install Node.js dependencies
npm install

# Generate Prisma client
npm run generate
```

### 3. **Database Migration**

```bash
# Push schema to database (creates tables)
npm run db:push

# OR use migrations (recommended for production)
npm run migrate
```

### 4. **Import Dataset**

```bash
# Import the CSV data
npm run import

# OR run directly
node prisma_import.js
```

### 5. **Verify Import**

```bash
# Run example queries
node prisma_queries.js

# OR open Prisma Studio
npm run studio
```

## 📊 **Database Schema**

The Prisma schema creates the following table:

```prisma
model GomellaBookOfPediatric {
  id          Int      @id @default(autoincrement())
  text        String
  pageNumber  Int?     @map("page_number")
  sourceFile  String?  @map("source_file")
  embedding   Json?    // Vector embeddings as JSON
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("gomella_book_of_pediatric")
}
```

## 🔍 **Query Examples**

### Basic Text Search
```javascript
const results = await prisma.gomellaBookOfPediatric.findMany({
  where: {
    text: {
      contains: 'neonatal resuscitation',
      mode: 'insensitive'
    }
  },
  take: 10
});
```

### Page Range Search
```javascript
const results = await prisma.gomellaBookOfPediatric.findMany({
  where: {
    pageNumber: {
      gte: 100,
      lte: 200
    }
  }
});
```

### Vector Similarity Search
```javascript
// Use the provided utility functions
const { vectorSimilaritySearch } = require('./prisma_queries');

const results = await vectorSimilaritySearch(
  queryEmbedding,  // Your query vector
  0.7,            // Similarity threshold
  10              // Max results
);
```

## 📁 **File Structure**

```
├── prisma/
│   └── schema.prisma          # Database schema
├── prisma_import.js           # CSV import script
├── prisma_queries.js          # Query examples and utilities
├── package.json               # Node.js dependencies
├── .env.example              # Environment template
├── gomella_book_data.csv     # Dataset (1000 records)
└── PRISMA_SETUP.md           # This guide
```

## 🛠️ **Available Scripts**

| Script | Description |
|--------|-------------|
| `npm run import` | Import CSV data to database |
| `npm run generate` | Generate Prisma client |
| `npm run migrate` | Run database migrations |
| `npm run db:push` | Push schema to database |
| `npm run studio` | Open Prisma Studio |
| `npm run setup` | Install deps + generate client |

## 🔧 **Configuration Options**

### Environment Variables (.env)
```bash
DATABASE_URL="your_prisma_database_url"
BATCH_SIZE="100"                    # Import batch size
CSV_FILE_PATH="gomella_book_data.csv"  # CSV file path
```

### Import Configuration
You can modify the import behavior in `prisma_import.js`:

```javascript
const BATCH_SIZE = 100;  // Records per batch
const CSV_FILE_PATH = 'gomella_book_data.csv';
```

## 📊 **Dataset Information**

- **Records**: 1,000 sample entries
- **File Size**: 8.2MB
- **Embedding Dimensions**: 384 (all-MiniLM-L6-v2)
- **Source Files**: 2 PDF parts
- **Page Range**: 1-1000 (sample data)

## 🔍 **Search Capabilities**

### 1. **Text Search**
- Case-insensitive text matching
- Partial text search
- Full-text search capabilities

### 2. **Page-Based Search**
- Search by specific page numbers
- Page range queries
- Source file filtering

### 3. **Vector Similarity Search**
- Cosine similarity calculation
- Configurable similarity thresholds
- Batch processing for large datasets

### 4. **Hybrid Search**
- Combine text and vector search
- Weighted scoring
- Advanced filtering options

## 🚨 **Troubleshooting**

### Common Issues

1. **Database Connection Error**
   ```bash
   # Check your DATABASE_URL in .env
   # Ensure database is accessible
   npx prisma db pull  # Test connection
   ```

2. **Import Fails**
   ```bash
   # Check CSV file exists
   ls -la gomella_book_data.csv
   
   # Check file format
   head -5 gomella_book_data.csv
   ```

3. **Schema Sync Issues**
   ```bash
   # Reset database (⚠️ destroys data)
   npx prisma migrate reset
   
   # OR push schema changes
   npx prisma db push
   ```

4. **Memory Issues During Import**
   ```bash
   # Reduce batch size in prisma_import.js
   const BATCH_SIZE = 50;  // Smaller batches
   ```

### Performance Tips

1. **Large Datasets**
   - Use smaller batch sizes (50-100 records)
   - Consider streaming imports
   - Monitor memory usage

2. **Vector Search Optimization**
   - Use database-level vector extensions (pgvector)
   - Index embeddings for faster search
   - Cache frequently used embeddings

3. **Query Optimization**
   - Use appropriate indexes
   - Limit result sets
   - Use pagination for large results

## 🔐 **Security Notes**

1. **Never commit .env files** to version control
2. **Use environment variables** for sensitive data
3. **Rotate database credentials** regularly
4. **Use connection pooling** for production

## 📈 **Next Steps**

1. **Scale Up**: Process full PDF content (not just samples)
2. **Add Indexes**: Create database indexes for better performance
3. **Vector Extensions**: Implement pgvector for native vector search
4. **API Layer**: Build REST/GraphQL API on top of Prisma
5. **Frontend**: Create search interface for the dataset

## 🆘 **Support**

If you encounter issues:

1. Check the troubleshooting section above
2. Review Prisma documentation: https://prisma.io/docs
3. Check database logs for connection issues
4. Verify CSV file format and content

---

**Happy searching! 🏥📚**


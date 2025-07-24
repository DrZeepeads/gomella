#!/usr/bin/env node

/**
 * Prisma Import Script for Gomella's Neonatology Dataset
 * 
 * This script imports the generated CSV data into a Prisma-managed PostgreSQL database.
 * It handles the conversion of JSON embeddings and batch processing for efficiency.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Initialize Prisma client
const prisma = new PrismaClient();

// Configuration
const CSV_FILE_PATH = 'gomella_book_data.csv';
const BATCH_SIZE = 100; // Process records in batches for better performance

/**
 * Parse CSV and convert to Prisma-compatible format
 */
async function parseCSVData(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        
        if (!fs.existsSync(filePath)) {
            reject(new Error(`CSV file not found: ${filePath}`));
            return;
        }

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    // Parse the embedding JSON string
                    let embedding = null;
                    if (row.embedding && row.embedding.trim()) {
                        embedding = JSON.parse(row.embedding);
                    }

                    // Convert to Prisma format
                    const record = {
                        text: row.text,
                        pageNumber: row.page_number ? parseInt(row.page_number) : null,
                        sourceFile: row.source_file || null,
                        embedding: embedding
                    };

                    results.push(record);
                } catch (error) {
                    console.warn(`Warning: Failed to parse row:`, error.message);
                }
            })
            .on('end', () => {
                console.log(`✅ Parsed ${results.length} records from CSV`);
                resolve(results);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

/**
 * Import data in batches to avoid memory issues
 */
async function importDataInBatches(data) {
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);
    let importedCount = 0;

    console.log(`📦 Importing ${data.length} records in ${totalBatches} batches...`);

    for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, data.length);
        const batch = data.slice(start, end);

        try {
            // Use createMany for efficient batch insertion
            const result = await prisma.gomellaBookOfPediatric.createMany({
                data: batch,
                skipDuplicates: true // Skip if records already exist
            });

            importedCount += result.count;
            console.log(`✅ Batch ${i + 1}/${totalBatches}: Imported ${result.count} records`);
        } catch (error) {
            console.error(`❌ Error in batch ${i + 1}:`, error.message);
            
            // Try individual inserts for this batch to identify problematic records
            console.log(`🔄 Retrying batch ${i + 1} with individual inserts...`);
            for (const record of batch) {
                try {
                    await prisma.gomellaBookOfPediatric.create({
                        data: record
                    });
                    importedCount++;
                } catch (individualError) {
                    console.warn(`⚠️  Failed to import record:`, {
                        text: record.text.substring(0, 50) + '...',
                        error: individualError.message
                    });
                }
            }
        }
    }

    return importedCount;
}

/**
 * Verify the import by checking record counts and sample data
 */
async function verifyImport() {
    console.log('\n🔍 Verifying import...');

    // Count total records
    const totalCount = await prisma.gomellaBookOfPediatric.count();
    console.log(`📊 Total records in database: ${totalCount}`);

    // Check records by source file
    const sourceFileStats = await prisma.gomellaBookOfPediatric.groupBy({
        by: ['sourceFile'],
        _count: {
            id: true
        },
        _min: {
            pageNumber: true
        },
        _max: {
            pageNumber: true
        }
    });

    console.log('\n📁 Records by source file:');
    sourceFileStats.forEach(stat => {
        console.log(`  ${stat.sourceFile}: ${stat._count.id} records (pages ${stat._min.pageNumber}-${stat._max.pageNumber})`);
    });

    // Show sample records
    const sampleRecords = await prisma.gomellaBookOfPediatric.findMany({
        take: 3,
        select: {
            id: true,
            text: true,
            pageNumber: true,
            sourceFile: true,
            createdAt: true
        }
    });

    console.log('\n📝 Sample records:');
    sampleRecords.forEach(record => {
        console.log(`  ID ${record.id}: "${record.text.substring(0, 80)}..." (Page ${record.pageNumber})`);
    });

    // Check for records with embeddings
    const embeddingCount = await prisma.gomellaBookOfPediatric.count({
        where: {
            embedding: {
                not: null
            }
        }
    });

    console.log(`\n🧠 Records with embeddings: ${embeddingCount}/${totalCount}`);
}

/**
 * Main execution function
 */
async function main() {
    console.log('🚀 Starting Gomella dataset import to Prisma database...\n');

    try {
        // Test database connection
        console.log('🔌 Testing database connection...');
        await prisma.$connect();
        console.log('✅ Database connection successful\n');

        // Parse CSV data
        console.log('📖 Reading CSV file...');
        const data = await parseCSVData(CSV_FILE_PATH);

        if (data.length === 0) {
            console.log('⚠️  No data found in CSV file');
            return;
        }

        // Import data
        const importedCount = await importDataInBatches(data);
        console.log(`\n🎉 Import completed! Successfully imported ${importedCount} records`);

        // Verify import
        await verifyImport();

        console.log('\n✅ Gomella dataset import completed successfully!');
        console.log('\n🔍 Next steps:');
        console.log('1. Run vector similarity queries using the embedding data');
        console.log('2. Set up full-text search indexes if needed');
        console.log('3. Test the search functionality with sample queries');

    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
    console.log('\n🛑 Import interrupted by user');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Import terminated');
    await prisma.$disconnect();
    process.exit(0);
});

// Run the import
if (require.main === module) {
    main().catch((error) => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { main, parseCSVData, importDataInBatches, verifyImport };


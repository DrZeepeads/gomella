#!/usr/bin/env node

/**
 * Prisma Query Examples for Gomella's Neonatology Dataset
 * 
 * This file contains example queries and utilities for searching
 * the Gomella dataset using Prisma ORM.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Search by text content (basic text search)
 */
async function searchByText(searchTerm, limit = 10) {
    console.log(`🔍 Searching for: "${searchTerm}"`);
    
    const results = await prisma.gomellaBookOfPediatric.findMany({
        where: {
            text: {
                contains: searchTerm,
                mode: 'insensitive'
            }
        },
        take: limit,
        orderBy: {
            pageNumber: 'asc'
        }
    });

    console.log(`📊 Found ${results.length} results:`);
    results.forEach((result, index) => {
        console.log(`${index + 1}. Page ${result.pageNumber}: "${result.text.substring(0, 100)}..."`);
    });

    return results;
}

/**
 * Search by page range
 */
async function searchByPageRange(startPage, endPage) {
    console.log(`📖 Searching pages ${startPage}-${endPage}`);
    
    const results = await prisma.gomellaBookOfPediatric.findMany({
        where: {
            pageNumber: {
                gte: startPage,
                lte: endPage
            }
        },
        orderBy: {
            pageNumber: 'asc'
        }
    });

    console.log(`📊 Found ${results.length} records in page range ${startPage}-${endPage}`);
    return results;
}

/**
 * Search by source file
 */
async function searchBySourceFile(sourceFile) {
    console.log(`📁 Searching in source file: "${sourceFile}"`);
    
    const results = await prisma.gomellaBookOfPediatric.findMany({
        where: {
            sourceFile: {
                contains: sourceFile,
                mode: 'insensitive'
            }
        },
        orderBy: {
            pageNumber: 'asc'
        }
    });

    console.log(`📊 Found ${results.length} records from source file`);
    return results;
}

/**
 * Get records with embeddings for vector search
 */
async function getRecordsWithEmbeddings(limit = 10) {
    console.log(`🧠 Getting records with embeddings (limit: ${limit})`);
    
    const results = await prisma.gomellaBookOfPediatric.findMany({
        where: {
            embedding: {
                not: null
            }
        },
        take: limit,
        select: {
            id: true,
            text: true,
            pageNumber: true,
            sourceFile: true,
            embedding: true
        }
    });

    console.log(`📊 Found ${results.length} records with embeddings`);
    return results;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Perform vector similarity search (client-side)
 * Note: For production, consider using PostgreSQL's pgvector extension
 */
async function vectorSimilaritySearch(queryEmbedding, threshold = 0.7, limit = 10) {
    console.log(`🎯 Performing vector similarity search (threshold: ${threshold})`);
    
    // Get all records with embeddings
    const records = await prisma.gomellaBookOfPediatric.findMany({
        where: {
            embedding: {
                not: null
            }
        },
        select: {
            id: true,
            text: true,
            pageNumber: true,
            sourceFile: true,
            embedding: true
        }
    });

    // Calculate similarities
    const similarities = records.map(record => {
        const similarity = cosineSimilarity(queryEmbedding, record.embedding);
        return {
            ...record,
            similarity
        };
    });

    // Filter and sort by similarity
    const results = similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    console.log(`📊 Found ${results.length} similar records:`);
    results.forEach((result, index) => {
        console.log(`${index + 1}. Similarity: ${result.similarity.toFixed(3)} | Page ${result.pageNumber}: "${result.text.substring(0, 80)}..."`);
    });

    return results;
}

/**
 * Get dataset statistics
 */
async function getDatasetStats() {
    console.log('📊 Generating dataset statistics...\n');

    // Total records
    const totalRecords = await prisma.gomellaBookOfPediatric.count();
    console.log(`📈 Total records: ${totalRecords}`);

    // Records with embeddings
    const embeddingCount = await prisma.gomellaBookOfPediatric.count({
        where: {
            embedding: {
                not: null
            }
        }
    });
    console.log(`🧠 Records with embeddings: ${embeddingCount}`);

    // Records by source file
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

    // Page range
    const pageStats = await prisma.gomellaBookOfPediatric.aggregate({
        _min: {
            pageNumber: true
        },
        _max: {
            pageNumber: true
        },
        _avg: {
            pageNumber: true
        }
    });

    console.log(`\n📖 Page range: ${pageStats._min.pageNumber} - ${pageStats._max.pageNumber} (avg: ${pageStats._avg.pageNumber?.toFixed(1)})`);

    // Text length statistics
    const records = await prisma.gomellaBookOfPediatric.findMany({
        select: {
            text: true
        }
    });

    const textLengths = records.map(r => r.text.length);
    const avgTextLength = textLengths.reduce((a, b) => a + b, 0) / textLengths.length;
    const minTextLength = Math.min(...textLengths);
    const maxTextLength = Math.max(...textLengths);

    console.log(`\n📝 Text length: min=${minTextLength}, max=${maxTextLength}, avg=${avgTextLength.toFixed(1)} characters`);

    return {
        totalRecords,
        embeddingCount,
        sourceFileStats,
        pageStats,
        textStats: {
            min: minTextLength,
            max: maxTextLength,
            avg: avgTextLength
        }
    };
}

/**
 * Example usage and testing
 */
async function runExamples() {
    console.log('🚀 Running Gomella dataset query examples...\n');

    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connection successful\n');

        // Get dataset statistics
        await getDatasetStats();

        console.log('\n' + '='.repeat(50));
        console.log('🔍 SEARCH EXAMPLES');
        console.log('='.repeat(50));

        // Example 1: Text search
        console.log('\n1. Text Search Example:');
        await searchByText('neonatal resuscitation', 3);

        // Example 2: Page range search
        console.log('\n2. Page Range Search Example:');
        await searchByPageRange(1, 10);

        // Example 3: Source file search
        console.log('\n3. Source File Search Example:');
        await searchBySourceFile('sample_file_1.pdf');

        // Example 4: Records with embeddings
        console.log('\n4. Records with Embeddings Example:');
        const embeddingRecords = await getRecordsWithEmbeddings(3);

        // Example 5: Vector similarity search (if embeddings exist)
        if (embeddingRecords.length > 0) {
            console.log('\n5. Vector Similarity Search Example:');
            const queryEmbedding = embeddingRecords[0].embedding; // Use first record as query
            await vectorSimilaritySearch(queryEmbedding, 0.8, 5);
        }

        console.log('\n✅ All examples completed successfully!');

    } catch (error) {
        console.error('❌ Error running examples:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Export functions for use in other modules
module.exports = {
    searchByText,
    searchByPageRange,
    searchBySourceFile,
    getRecordsWithEmbeddings,
    vectorSimilaritySearch,
    getDatasetStats,
    cosineSimilarity
};

// Run examples if this file is executed directly
if (require.main === module) {
    runExamples().catch(console.error);
}


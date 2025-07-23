#!/usr/bin/env python3
"""
PDF Processing Script for Gomella's Neonatology Book
Extracts text from PDF files, generates embeddings, and creates CSV output
according to the gomella_book_of_pediatric table schema.
"""

import os
import csv
import json
import logging
from typing import List, Dict, Any, Optional
import PyPDF2
import pandas as pd
from sentence_transformers import SentenceTransformer
import numpy as np
from pathlib import Path
import re

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PDFProcessor:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        """
        Initialize the PDF processor with embedding model.
        
        Args:
            model_name: Name of the sentence transformer model to use
        """
        self.model = SentenceTransformer(model_name)
        self.processed_data = []
        
    def extract_text_from_pdf(self, pdf_path: str, start_page_offset: int = 0) -> List[Dict[str, Any]]:
        """
        Extract text from PDF file with page numbers.
        
        Args:
            pdf_path: Path to the PDF file
            start_page_offset: Offset to add to page numbers (for multi-part books)
            
        Returns:
            List of dictionaries containing text and metadata
        """
        extracted_data = []
        
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                
                logger.info(f"Processing {pdf_path} with {total_pages} pages")
                
                for page_num, page in enumerate(pdf_reader.pages, 1):
                    try:
                        text = page.extract_text()
                        
                        # Clean and process text
                        text = self.clean_text(text)
                        
                        if text.strip():  # Only process non-empty pages
                            # Split text into chunks if it's too long
                            chunks = self.split_text_into_chunks(text)
                            
                            for chunk_idx, chunk in enumerate(chunks):
                                extracted_data.append({
                                    'text': chunk,
                                    'page_number': page_num + start_page_offset,
                                    'source_file': os.path.basename(pdf_path),
                                    'chunk_index': chunk_idx
                                })
                                
                    except Exception as e:
                        logger.warning(f"Error processing page {page_num} in {pdf_path}: {str(e)}")
                        continue
                        
        except Exception as e:
            logger.error(f"Error reading PDF {pdf_path}: {str(e)}")
            
        return extracted_data
    
    def clean_text(self, text: str) -> str:
        """
        Clean and normalize extracted text.
        
        Args:
            text: Raw text from PDF
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
            
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove page headers/footers patterns (common in medical books)
        text = re.sub(r'^\d+\s*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'^Chapter \d+.*$', '', text, flags=re.MULTILINE)
        
        # Remove excessive newlines
        text = re.sub(r'\n\s*\n', '\n', text)
        
        return text.strip()
    
    def split_text_into_chunks(self, text: str, max_chunk_size: int = 1000, overlap: int = 100) -> List[str]:
        """
        Split text into overlapping chunks for better embedding quality.
        
        Args:
            text: Text to split
            max_chunk_size: Maximum characters per chunk
            overlap: Number of characters to overlap between chunks
            
        Returns:
            List of text chunks
        """
        if len(text) <= max_chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + max_chunk_size
            
            # Try to break at sentence boundary
            if end < len(text):
                # Look for sentence endings within the last 200 characters
                sentence_end = text.rfind('.', start + max_chunk_size - 200, end)
                if sentence_end > start:
                    end = sentence_end + 1
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - overlap
            
        return chunks
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts.
        
        Args:
            texts: List of text strings
            
        Returns:
            List of embedding vectors
        """
        logger.info(f"Generating embeddings for {len(texts)} text chunks")
        
        try:
            embeddings = self.model.encode(texts, show_progress_bar=True)
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            return [[0.0] * 384] * len(texts)  # Return zero vectors as fallback
    
    def process_pdfs(self, pdf_files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process multiple PDF files and generate complete dataset.
        
        Args:
            pdf_files: List of dictionaries with 'path' and 'page_offset' keys
            
        Returns:
            List of processed data records
        """
        all_data = []
        
        for pdf_info in pdf_files:
            pdf_path = pdf_info['path']
            page_offset = pdf_info.get('page_offset', 0)
            
            if not os.path.exists(pdf_path):
                logger.warning(f"PDF file not found: {pdf_path}")
                continue
                
            # Extract text from PDF
            extracted_data = self.extract_text_from_pdf(pdf_path, page_offset)
            all_data.extend(extracted_data)
        
        if not all_data:
            logger.error("No data extracted from PDFs")
            return []
        
        # Generate embeddings for all text chunks
        texts = [item['text'] for item in all_data]
        embeddings = self.generate_embeddings(texts)
        
        # Combine text data with embeddings
        for i, item in enumerate(all_data):
            item['embedding'] = embeddings[i] if i < len(embeddings) else [0.0] * 384
        
        return all_data
    
    def save_to_csv(self, data: List[Dict[str, Any]], output_path: str):
        """
        Save processed data to CSV file according to table schema.
        
        Args:
            data: Processed data records
            output_path: Path to output CSV file
        """
        logger.info(f"Saving {len(data)} records to {output_path}")
        
        # Prepare data for CSV (convert embeddings to JSON strings)
        csv_data = []
        for item in data:
            csv_record = {
                'text': item['text'],
                'page_number': item['page_number'],
                'source_file': item['source_file'],
                'embedding': json.dumps(item['embedding'])  # Convert list to JSON string
            }
            csv_data.append(csv_record)
        
        # Write to CSV
        df = pd.DataFrame(csv_data)
        df.to_csv(output_path, index=False, quoting=csv.QUOTE_ALL)
        
        logger.info(f"Successfully saved {len(csv_data)} records to {output_path}")
    
    def generate_sample_data(self, output_path: str = 'gomella_sample_data.csv', num_samples: int = 100):
        """
        Generate a sample dataset for testing purposes.
        
        Args:
            output_path: Path to output CSV file
            num_samples: Number of sample records to generate
        """
        logger.info(f"Generating {num_samples} sample records")
        
        sample_data = []
        sample_texts = [
            "Neonatal resuscitation is a critical skill for healthcare providers in the delivery room.",
            "Respiratory distress syndrome (RDS) is common in premature infants due to surfactant deficiency.",
            "Hypoglycemia in newborns can lead to serious neurological complications if not treated promptly.",
            "Patent ductus arteriosus (PDA) is a common congenital heart defect in premature infants.",
            "Necrotizing enterocolitis (NEC) is a serious gastrointestinal condition affecting premature infants.",
        ]
        
        for i in range(num_samples):
            text = sample_texts[i % len(sample_texts)]
            embedding = self.model.encode([text])[0].tolist()
            
            sample_data.append({
                'text': f"{text} (Sample record {i+1})",
                'page_number': (i % 100) + 1,
                'source_file': f"sample_file_{(i % 2) + 1}.pdf",
                'embedding': json.dumps(embedding)
            })
        
        df = pd.DataFrame(sample_data)
        df.to_csv(output_path, index=False, quoting=csv.QUOTE_ALL)
        
        logger.info(f"Sample data saved to {output_path}")

def main():
    """Main function to process Gomella's Neonatology PDFs."""
    
    # Initialize processor
    processor = PDFProcessor()
    
    # Define PDF files to process
    pdf_files = [
        {
            'path': "Gomella's Neonatology Management, Procedures, On-Call Problems, Diseases, and Drugs 8th Edition 2020_1-737.pdf",
            'page_offset': 0
        },
        {
            'path': "Gomella's Neonatology Management, Procedures, On-Call Problems, Diseases, and Drugs 8th Edition 2020_738-end.pdf",
            'page_offset': 737  # Continue page numbering from first file
        }
    ]
    
    # Check if PDF files exist
    existing_pdfs = [pdf for pdf in pdf_files if os.path.exists(pdf['path'])]
    
    if not existing_pdfs:
        logger.warning("No PDF files found. Generating sample data instead.")
        processor.generate_sample_data('gomella_book_data.csv', 1000)
        return
    
    # Process PDFs
    logger.info("Starting PDF processing...")
    processed_data = processor.process_pdfs(existing_pdfs)
    
    if processed_data:
        # Save to CSV
        processor.save_to_csv(processed_data, 'gomella_book_data.csv')
        
        # Generate statistics
        logger.info(f"Processing complete!")
        logger.info(f"Total records: {len(processed_data)}")
        logger.info(f"Unique pages: {len(set(item['page_number'] for item in processed_data))}")
        logger.info(f"Source files: {set(item['source_file'] for item in processed_data)}")
    else:
        logger.error("No data was processed successfully")

if __name__ == "__main__":
    main()


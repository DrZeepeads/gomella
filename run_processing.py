#!/usr/bin/env python3
"""
Simple script to run the PDF processing and generate the dataset.
This script handles the complete workflow from PDF extraction to CSV generation.
"""

import os
import sys
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('processing.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def check_dependencies():
    """Check if required dependencies are installed."""
    required_packages = {
        'PyPDF2': 'PyPDF2',
        'pandas': 'pandas', 
        'sentence_transformers': 'sentence_transformers',
        'numpy': 'numpy'
    }
    
    missing_packages = []
    for display_name, import_name in required_packages.items():
        try:
            __import__(import_name)
        except ImportError:
            missing_packages.append(display_name)
    
    if missing_packages:
        logger.error(f"Missing required packages: {', '.join(missing_packages)}")
        logger.error("Please install them using: pip install -r requirements.txt")
        return False
    
    return True

def check_pdf_files():
    """Check if PDF files exist in the current directory."""
    pdf_files = [
        "Gomella's Neonatology Management, Procedures, On-Call Problems, Diseases, and Drugs 8th Edition 2020_1-737.pdf",
        "Gomella's Neonatology Management, Procedures, On-Call Problems, Diseases, and Drugs 8th Edition 2020_738-end.pdf"
    ]
    
    existing_files = []
    for pdf_file in pdf_files:
        if os.path.exists(pdf_file):
            existing_files.append(pdf_file)
            logger.info(f"Found PDF file: {pdf_file}")
        else:
            logger.warning(f"PDF file not found: {pdf_file}")
    
    return existing_files

def main():
    """Main execution function."""
    logger.info("Starting Gomella's Neonatology PDF processing...")
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Check PDF files
    pdf_files = check_pdf_files()
    
    if not pdf_files:
        logger.warning("No PDF files found. Will generate sample data instead.")
    
    # Import and run the processor
    try:
        from pdf_processor import PDFProcessor
        
        processor = PDFProcessor()
        
        if pdf_files:
            # Process actual PDF files
            pdf_info = []
            for i, pdf_file in enumerate(pdf_files):
                offset = 737 if '738-end' in pdf_file else 0
                pdf_info.append({
                    'path': pdf_file,
                    'page_offset': offset
                })
            
            logger.info(f"Processing {len(pdf_files)} PDF files...")
            processed_data = processor.process_pdfs(pdf_info)
            
            if processed_data:
                processor.save_to_csv(processed_data, 'gomella_book_data.csv')
                logger.info(f"Successfully processed {len(processed_data)} text chunks")
            else:
                logger.error("No data was processed from PDF files")
                return False
        else:
            # Generate sample data
            logger.info("Generating sample data...")
            processor.generate_sample_data('gomella_book_data.csv', 1000)
        
        # Verify output file
        if os.path.exists('gomella_book_data.csv'):
            file_size = os.path.getsize('gomella_book_data.csv')
            logger.info(f"Output file created: gomella_book_data.csv ({file_size:,} bytes)")
            
            # Show first few lines
            with open('gomella_book_data.csv', 'r', encoding='utf-8') as f:
                lines = f.readlines()[:5]
                logger.info(f"CSV file contains {len(lines)} header + sample lines")
                logger.info("First few lines of the CSV:")
                for i, line in enumerate(lines):
                    logger.info(f"  Line {i+1}: {line.strip()[:100]}...")
            
            return True
        else:
            logger.error("Output file was not created")
            return False
            
    except ImportError as e:
        logger.error(f"Failed to import required modules: {e}")
        logger.error("Please ensure all dependencies are installed: pip install -r requirements.txt")
        return False
    except Exception as e:
        logger.error(f"Error during processing: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        logger.info("Processing completed successfully!")
        logger.info("Next steps:")
        logger.info("1. Set up PostgreSQL database using database_schema.sql")
        logger.info("2. Import the CSV data using the COPY command")
        logger.info("3. Test the search functions")
    else:
        logger.error("Processing failed!")
        sys.exit(1)

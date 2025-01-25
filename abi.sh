#!/bin/bash

# Default values
SOURCE_DIR="out"
OUTPUT_DIR="abi"
VERBOSE=false

# Function to print usage instructions
print_usage() {
    echo "Usage: $0 [-s SOURCE_DIR] [-o OUTPUT_DIR] [-v]"
    echo ""
    echo "Options:"
    echo "  -s SOURCE_DIR      Source directory containing Forge output (default: 'out')"
    echo "  -o OUTPUT_DIR      Output directory for ABI files (default: 'abi')"
    echo "  -v                 Verbose mode"
    echo "  -h                 Show this help message"
    echo ""
    echo "Example:"
    echo "  $0"
    echo "  $0 -s ./out -o ./abis -v"
}

# Parse command line arguments
while getopts "s:o:vh" opt; do
    case $opt in
        s) SOURCE_DIR="$OPTARG";;
        o) OUTPUT_DIR="$OPTARG";;
        v) VERBOSE=true;;
        h) print_usage; exit 0;;
        ?) print_usage; exit 1;;
    esac
done

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed"
    echo "Please install jq first:"
    echo "  Debian/Ubuntu: sudo apt-get install jq"
    echo "  MacOS: brew install jq"
    exit 1
fi

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory '$SOURCE_DIR' not found"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Function to log verbose messages
log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo "$1"
    fi
}

# Function to extract ABI from a contract file
extract_abi() {
    local contract_file="$1"
    local contract_name=$(basename "$(dirname "$contract_file")")
    local output_file="$OUTPUT_DIR/${contract_name}.abi.json"
    
    log_verbose "Processing contract: $contract_name"
    
    # Extract and format the ABI
    if jq '.abi' "$contract_file" > "$output_file" 2>/dev/null; then
        if [ "$VERBOSE" = true ]; then
            local abi_size=$(wc -c < "$output_file")
            echo "✓ Created $output_file (${abi_size} bytes)"
        fi
        return 0
    else
        echo "✗ Failed to extract ABI from $contract_file"
        return 1
    fi
}

# Counter variables
total_contracts=0
successful_extractions=0
failed_extractions=0

# Find all JSON files in the source directory that match Forge's output pattern
echo "Scanning $SOURCE_DIR for contract artifacts..."

while IFS= read -r -d '' contract_file; do
    # Skip if the file doesn't end with .json
    if [[ ! "$contract_file" =~ \.json$ ]]; then
        continue
    fi
    
    # Increment total counter
    ((total_contracts++))
    
    # Extract ABI
    if extract_abi "$contract_file"; then
        ((successful_extractions++))
    else
        ((failed_extractions++))
    fi

done < <(find "$SOURCE_DIR" -type f -name "*.json" -print0)

# Print summary
echo ""
echo "Extraction Summary:"
echo "==================="
echo "Total contracts found: $total_contracts"
echo "Successfully extracted: $successful_extractions"
echo "Failed extractions: $failed_extractions"
echo ""
echo "ABI files have been saved to: $OUTPUT_DIR"

# Exit with error if any extractions failed
if [ "$failed_extractions" -gt 0 ]; then
    exit 1
fi

exit 0
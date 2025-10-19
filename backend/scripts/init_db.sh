#!/bin/bash
# Initialize Governance Learning Content
# This script sets up the database with Section 1: What is Governance?

cd "$(dirname "$0")/.."

echo "=================================================="
echo "Governance Learning Content - Database Setup"
echo "=================================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "⚠️  No virtual environment found."
    echo "Please create one first:"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements/base.txt"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

echo "✓ Virtual environment activated"
echo ""

# Run the initialization script
echo "Running database initialization..."
python scripts/init_governance_content.py

if [ $? -eq 0 ]; then
    echo ""
    echo "=================================================="
    echo "✅ SUCCESS! Database initialized with content."
    echo "=================================================="
    echo ""
    echo "Next steps:"
    echo "  1. Start the backend: uvicorn app.main:app --reload"
    echo "  2. Navigate to Learning Hub in the frontend"
    echo "  3. Explore 'Section 1: What is Governance?'"
    echo ""
else
    echo ""
    echo "❌ Initialization failed. Check the error messages above."
    exit 1
fi

#!/bin/bash

# Simple script to start the AI Trace Viewer

echo "=================================="
echo "AI Trace Viewer"
echo "=================================="
echo ""
echo "Starting server on http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Start the server (using entry point if installed, fallback to module)
if command -v aitrace &> /dev/null; then
    aitrace
else
    python -m aitrace
fi


#!/bin/bash
# Double-click this file on event day to launch A.G.E.N.C.Y.
# Chrome will open automatically in kiosk mode.
# Press Ctrl+C in this window to stop the server.

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo ""
  echo "  ⚠  No .env file found."
  echo "  Copy .env.example to .env and add your ANTHROPIC_API_KEY."
  echo ""
fi

if [ ! -d node_modules ]; then
  echo "  Installing dependencies..."
  npm install --silent
fi

node server.js

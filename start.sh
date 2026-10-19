#!/bin/sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Please install it from https://nodejs.org and run this again."
  exit 1
fi
( sleep 1; (open http://localhost:5173 || xdg-open http://localhost:5173) >/dev/null 2>&1 ) &
node serve.mjs

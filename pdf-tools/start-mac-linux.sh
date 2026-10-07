#!/bin/sh
# Mac/Linux: double-click or run ./start-mac-linux.sh
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js nahi mila. https://nodejs.org se LTS install karen."; exit 1; }
[ -d node_modules ] || npm install
echo "PDFKaro: http://localhost:3000"
( sleep 2; open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null ) &
exec node server.js

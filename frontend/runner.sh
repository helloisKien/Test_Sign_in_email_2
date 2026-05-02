#!/bin/bash
set -x

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 || nvm install 20

echo "Using node: $(node -v)"
echo "Using npm: $(npm -v)"

rm -rf node_modules package-lock.json pnpm-lock.yaml .next
npm install
npm install @tailwindcss/oxide-linux-x64-gnu
npm run build
npm run dev

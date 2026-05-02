#!/bin/bash
set -e
if [ ! -d /tmp/node-v20 ]; then
  curl -fsSL https://nodejs.org/dist/v20.10.0/node-v20.10.0-linux-x64.tar.xz -o /tmp/node20.tar.xz
  mkdir -p /tmp/node-v20
  tar -xf /tmp/node20.tar.xz -C /tmp/node-v20 --strip-components=1
fi
export PATH="/tmp/node-v20/bin:$PATH"
rm -rf node_modules package-lock.json pnpm-lock.yaml
npm install
npm run dev

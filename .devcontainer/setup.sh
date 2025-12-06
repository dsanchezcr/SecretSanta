#!/bin/bash
set -e

echo "🐳 Installing Docker CLI and Docker Compose..."
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
sh /tmp/get-docker.sh
rm /tmp/get-docker.sh

echo "📦 Installing npm dependencies..."
npm install

echo "⚙️  Setting up API..."
(cd api && npm install)

echo "🔧 Creating local settings..."
(cd api && node ../scripts/setup-local-settings.js)

echo "✅ Setup complete!"

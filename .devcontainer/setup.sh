#!/bin/bash
set -e

echo "🐳 Installing Docker CLI and Docker Compose..."
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
sh /tmp/get-docker.sh
rm /tmp/get-docker.sh

# Ensure docker-compose is available (Docker Desktop style)
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose standalone..."
    DOCKER_COMPOSE_VERSION="v2.24.0"
    curl -SL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

echo "⚙️  Installing Azure Functions Core Tools..."
curl --fail --show-error https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /tmp/microsoft.gpg
mv /tmp/microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/debian/$(lsb_release -rs | cut -d'.' -f 1)/prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list'
apt-get update && apt-get install -y azure-functions-core-tools-4

echo "📦 Installing npm dependencies..."
npm install

echo "⚙️  Setting up API..."
(cd api && npm install)

echo "🔧 Creating local settings..."
(cd api && node ../scripts/setup-local-settings.js)

echo "✅ Setup complete!"

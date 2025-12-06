#!/usr/bin/env node

/**
 * Setup script to create local.settings.json from local.settings.json.example
 * This runs automatically when developers clone the repo and run setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiDir = path.join(__dirname, '..', 'api');
const localSettingsPath = path.join(apiDir, 'local.settings.json');
const examplePath = path.join(apiDir, 'local.settings.json.example');

// Only create if it doesn't exist
if (fs.existsSync(localSettingsPath)) {
  console.log('✓ local.settings.json already exists, skipping...');
  process.exit(0);
}

try {
  // Read the example file
  if (!fs.existsSync(examplePath)) {
    console.error('✗ local.settings.json.example not found');
    process.exit(1);
  }

  const exampleContent = fs.readFileSync(examplePath, 'utf8');

  // Write to local.settings.json
  fs.writeFileSync(localSettingsPath, exampleContent, 'utf8');

  console.log('✓ Created api/local.settings.json from template');
  console.log('  - Configured for local Cosmos DB emulator (https://localhost:8081)');
  console.log('  - Database: secretsanta');
  console.log('  - Ready for local development!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Make sure Docker is running: docker-compose up -d');
  console.log('  2. Start the app: npm run dev (or press F5 in VS Code)');
  console.log('  3. Your data will persist in the local emulator');

} catch (error) {
  console.error('✗ Error creating local.settings.json:', error.message);
  process.exit(1);
}

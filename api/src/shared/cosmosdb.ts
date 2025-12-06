import { webcrypto } from 'crypto'
import { CosmosClient, Database, Container } from '@azure/cosmos'
import { Game, Participant, Assignment } from './types'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'

// Removed global disabling of certificate validation. Instead, see clientOptions in initializeStorage below.

// Polyfill for older Node.js runtimes in Azure Static Web Apps
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto
}

let cosmosClient: CosmosClient | null = null
let database: Database | null = null
let container: Container | null = null

// Database connection status
let databaseConnected = false
let connectionError: string | null = null

export interface DatabaseStatus {
  connected: boolean
  error: string | null
}

export function getDatabaseStatus(): DatabaseStatus {
  return {
    connected: databaseConnected,
    error: connectionError
  }
}

export async function initializeStorage(): Promise<void> {
  const endpoint = process.env.COSMOS_ENDPOINT
  const key = process.env.COSMOS_KEY
  
  if (!endpoint || !key) {
    connectionError = 'COSMOS_ENDPOINT and COSMOS_KEY environment variables are not configured'
    databaseConnected = false
    console.warn('⚠️ Database not configured - API will not persist data')
    return
  }
  
  const maxRetries = 10
  const retryDelayMs = 2000
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔌 Attempt ${attempt}/${maxRetries}: Initializing Cosmos DB connection to: ${endpoint.substring(0, 30)}...`)
      
      const clientOptions: any = {
        endpoint,
        key,
        connectionPolicy: {
          enableEndpointDiscovery: false
        }
      }

      // For local development with the Cosmos DB Emulator, set custom https.Agent
      if (
        process.env.ENVIRONMENT === 'local' ||
        (process.env.COSMOS_ENDPOINT && process.env.COSMOS_ENDPOINT.includes('localhost'))
      ) {
        // Where to find CosmosDB Emulator cert
        // Default Windows location: C:\\Program Files\\Azure Cosmos DB Emulator\\ssl\\cert.pem
        // Can override with COSMOS_EMULATOR_CERT_PATH env var or set appropriately per local setup
        const emulatorCertPath =
          process.env.COSMOS_EMULATOR_CERT_PATH ||
          (process.platform === 'win32'
            ? 'C:\\Program Files\\Azure Cosmos DB Emulator\\ssl\\cert.pem'
            : path.resolve(process.cwd(), 'certs', 'cosmosEmulatorCert.pem'));
        try {
          if (fs.existsSync(emulatorCertPath)) {
            const ca = fs.readFileSync(emulatorCertPath);
            clientOptions.agent = new https.Agent({ ca });
            console.log(`🔒 Cosmos DB local emulator: Using custom CA cert from ${emulatorCertPath}`);
          } else {
            // For Docker-based emulator, certificate isn't available locally
            // Use rejectUnauthorized: false for local development only
            console.warn(`⚠️ Local Cosmos DB emulator CA cert not found at: ${emulatorCertPath}`);
            console.log(`🔓 Using insecure connection for local Docker emulator (localhost only)`);
            clientOptions.agent = new https.Agent({ rejectUnauthorized: false });
          }
        } catch (err) {
          console.warn(`⚠️ Error reading Cosmos DB emulator CA certificate:`, err);
        }
      }
      
      cosmosClient = new CosmosClient(clientOptions)
      
      const databaseId = process.env.COSMOS_DATABASE_NAME || 'secretsanta'
      const containerId = process.env.COSMOS_CONTAINER_NAME || 'games'
      
      // Create database and container if they don't exist
      console.log('📊 Creating database:', databaseId)
      await cosmosClient.databases.createIfNotExists({ id: databaseId })
      database = cosmosClient.database(databaseId)
      
      console.log('📦 Creating container:', containerId)
      const { container: c } = await database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: ['/id'] }
      })
      container = c
      
      databaseConnected = true
      connectionError = null
      console.log('✅ Database connected successfully on attempt', attempt)
      return
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Cosmos DB'
      console.warn(`⚠️ Attempt ${attempt} failed: ${errorMessage}`)
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelayMs))
      } else {
        // Final attempt failed
        connectionError = errorMessage
        databaseConnected = false
        console.error('❌ Database connection failed after all retries:', errorMessage)
      }
    }
  }
}

function ensureConnected(): void {
  if (!databaseConnected) {
    throw new Error(`Database not available: ${connectionError || 'Not connected'}`)
  }
}

export function getCosmosClient(): CosmosClient {
  ensureConnected()
  if (!cosmosClient) {
    throw new Error('Cosmos DB client not initialized')
  }
  return cosmosClient
}

export function getDatabase(): Database {
  ensureConnected()
  if (!database) {
    throw new Error('Database not initialized')
  }
  return database
}

export async function getContainer(): Promise<Container> {
  ensureConnected()
  if (!container) {
    throw new Error('Container not initialized')
  }
  return container
}

export async function getGameByCode(code: string): Promise<Game | null> {
  const cont = await getContainer()
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.code = @code',
    parameters: [{ name: '@code', value: code }]
  }
  
  const { resources } = await cont.items.query<Game>(querySpec).fetchAll()
  return resources.length > 0 ? resources[0] : null
}

export async function getGameById(id: string): Promise<Game | null> {
  try {
    const cont = await getContainer()
    const { resource } = await cont.item(id, id).read<Game>()
    return resource || null
  } catch (error: any) {
    if (error.code === 404) {
      return null
    }
    throw error
  }
}

export async function createGame(game: Game): Promise<Game> {
  const cont = await getContainer()
  const { resource } = await cont.items.create<Game>(game)
  return resource!
}

export async function updateGame(game: Game): Promise<Game> {
  const cont = await getContainer()
  const { resource } = await cont.item(game.id, game.id).replace<Game>(game)
  return resource!
}

export async function deleteGame(id: string): Promise<void> {
  const cont = await getContainer()
  await cont.item(id, id).delete()
}

// Re-export types
export { Game, Participant, Assignment, GameUpdatePayload, ReassignmentRequest } from './types'

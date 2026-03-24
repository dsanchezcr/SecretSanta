/**
 * Validates that frontend and API types are in sync.
 * Run: node scripts/validate-types.cjs
 */
const fs = require('fs')
const path = require('path')

const frontendTypes = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'types.ts'), 'utf-8')
const apiTypes = fs.readFileSync(path.join(__dirname, '..', 'api', 'src', 'shared', 'types.ts'), 'utf-8')

// Extract interface names and their fields
function extractInterfaces(content) {
  const interfaces = {}
  const regex = /export interface (\w+)\s*\{([^}]+)\}/g
  let match
  while ((match = regex.exec(content)) !== null) {
    const name = match[1]
    const fields = match[2]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//') && !l.startsWith('*'))
      // Strip inline comments before comparing
      .map(l => l.replace(/\s*\/\/.*$/, '').trim())
      .filter(Boolean)
      .sort()
    interfaces[name] = fields
  }
  return interfaces
}

const frontendInterfaces = extractInterfaces(frontendTypes)
const apiInterfaces = extractInterfaces(apiTypes)

// Shared interfaces that must stay in sync
const sharedInterfaces = ['Participant', 'Assignment', 'Game', 'ReassignmentRequest', 'ExclusionPair']

let hasErrors = false
for (const name of sharedInterfaces) {
  if (!frontendInterfaces[name]) {
    console.error(`❌ Interface "${name}" missing from frontend types`)
    hasErrors = true
    continue
  }
  if (!apiInterfaces[name]) {
    console.error(`❌ Interface "${name}" missing from API types`)
    hasErrors = true
    continue
  }

  const frontendFields = frontendInterfaces[name]
  const apiFields = apiInterfaces[name]

  const frontendSet = new Set(frontendFields)
  const apiSet = new Set(apiFields)

  for (const field of apiFields) {
    if (!frontendSet.has(field)) {
      console.error(`❌ "${name}" field in API but not frontend: ${field}`)
      hasErrors = true
    }
  }
  for (const field of frontendFields) {
    if (!apiSet.has(field)) {
      console.error(`❌ "${name}" field in frontend but not API: ${field}`)
      hasErrors = true
    }
  }
}

if (hasErrors) {
  console.error('\n❌ Type validation failed!')
  process.exit(1)
} else {
  console.log('✅ Shared types are in sync')
}

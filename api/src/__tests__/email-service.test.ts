import { getEmailServiceStatus, initializeEmailService } from '../shared/email-service'

// Mock the EmailClient
jest.mock('@azure/communication-email', () => ({
  EmailClient: jest.fn().mockImplementation(() => ({
    beginSend: jest.fn()
  })),
  KnownEmailSendStatus: {
    Succeeded: 'Succeeded',
    Failed: 'Failed',
    Running: 'Running'
  }
}))

describe('Email Service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Clear environment variables
    delete process.env.ACS_CONNECTION_STRING
    delete process.env.ACS_SENDER_ADDRESS
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('getEmailServiceStatus', () => {
    it('should return not configured when env vars are not set and service not initialized', async () => {
      // Initialize without env vars
      await initializeEmailService()
      
      const status = getEmailServiceStatus()
      
      expect(status.configured).toBe(false)
      // Error message should indicate configuration issue
      expect(status.error).toBeTruthy()
    })

    it('should return configured when both env vars are set and initialized', async () => {
      process.env.ACS_CONNECTION_STRING = 'endpoint=https://test.communication.azure.com/;accesskey=testkey'
      process.env.ACS_SENDER_ADDRESS = 'DoNotReply@test.azurecomm.net'
      
      // Re-import to pick up new env vars
      jest.isolateModules(async () => {
        const { initializeEmailService: init, getEmailServiceStatus: getStatus } = require('../shared/email-service')
        await init()
        const status = getStatus()
        
        expect(status.configured).toBe(true)
        expect(status.error).toBeNull()
      })
    })
  })
})

/**
 * Jest setup file
 * Runs before all tests
 */

// Load environment variables for testing
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Mock console to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test timeout
jest.setTimeout(30000); // 30 seconds

// Global test setup
beforeAll(() => {
  // Setup code that runs once before all tests
});

// Global test teardown
afterAll(() => {
  // Cleanup code that runs once after all tests
});

// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

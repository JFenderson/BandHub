process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL;

jest.setTimeout(30000);

// Basic global mocks that are inexpensive to construct
const noop = () => undefined;

beforeEach(() => {
  jest.clearAllMocks();
});

// Provide a lightweight mock for the CacheService interface used across services
jest.mock('../src/cache/cache.service', () => {
  return {
    CacheService: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    })),
  };
});

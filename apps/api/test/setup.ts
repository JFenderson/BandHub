if (process.env.NODE_ENV !== 'test') {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true,
    configurable: true,
  });
}
process.env.DATABASE_URL = process.env.DATABASE_URL;

jest.setTimeout(30000);

// Basic global mocks that are inexpensive to construct
const noop = () => undefined;

beforeEach(() => {
  jest.clearAllMocks();
});

// Note: CacheService is mocked in individual tests as needed


import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  
  // Updated: More specific test matching for better organization
  testMatch: [
    '**/test/unit/**/*.spec.ts',
    '**/test/integration/**/*.spec.ts',
  ],

    testPathIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
    '/dist/',
    '/.next/',
  ],

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  
  collectCoverageFrom: ['<rootDir>/src/**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/test/coverage',
  coverageReporters: ['lcov', 'text-summary', 'html'], // Added 'html' for better reports
  
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  
  moduleNameMapper: {
    '^@hbcu-band-hub/shared-types$': '<rootDir>/../../libs/shared/types/src/index.ts',
  },
  
  // Coverage thresholds - can be adjusted per test type
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Useful additions:
  // Increased timeout for integration tests (they can be slower)
  testTimeout: 30000, // 30 seconds (default is 5 seconds)
  
  // Better error output
  verbose: true,
  
  // Clear mocks between tests automatically
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Maximum number of concurrent workers
  maxWorkers: '50%', // Use 50% of available CPU cores
};

export default config;
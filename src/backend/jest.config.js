/** @type {import('ts-jest').JestConfigWithTsJest} */
process.env.NODE_ENV = 'test';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],

  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],

  testTimeout: 30000,
  maxWorkers: 1,
  detectOpenHandles: true,
  clearMocks: true,
  verbose: true,
  forceExit: true,
  resetMocks: true,
  restoreMocks: true,
  resetModules: true,

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/app.ts',
    '!src/index.ts',
  ],
  transformIgnorePatterns: ['node_modules/(?!(nanoid)/)'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/index.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};

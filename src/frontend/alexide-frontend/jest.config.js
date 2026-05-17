module.exports = {
  testEnvironment: 'jest-environment-jsdom',

  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },

  transformIgnorePatterns: ['node_modules/(?!(monaco-editor|y-monaco|yjs|y-protocols|lib0)/)'],

  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx)', '**/*.(test|spec).(ts|tsx)'],

  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],

  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/index.tsx'],

  coverageReporters: ['text', 'cobertura'],
  coverageDirectory: 'coverage',
};

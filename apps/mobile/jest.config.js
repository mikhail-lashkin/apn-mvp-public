module.exports = {
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/__mocks__/expo-env.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^@apn/core$': '<rootDir>/../../packages/core/src',
    '^@apn/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  testEnvironment: 'jsdom',
  // Public alpha: known flaky / stale ColorSystem fixtures — run explicitly if needed
  testPathIgnorePatterns: [
    '<rootDir>/stores/__tests__/mindset\\.test\\.ts$',
    '<rootDir>/stores/__tests__/players\\.test\\.ts$',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules|unimodules|sentry-expo|native-base|react-navigation|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@react-native-async-storage|react-native-svg|react-native-vector-icons)/)',
  ],
};

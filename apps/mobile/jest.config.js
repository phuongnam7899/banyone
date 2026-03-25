/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/global\\.css$': '<rootDir>/jest/cssMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.css$': '<rootDir>/jest/cssMock.js',
  },
  testPathIgnorePatterns: ['/node_modules/'],
};

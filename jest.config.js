export default {
  testEnvironment: 'node',
  transform: {},
  collectCoverageFrom: ['src/**/*.{js,ts}', '!src/index.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/test/**/*.test.js'],
};

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    '*.{ts,tsx}',
    '!*.d.ts',
    '!jest.config.js',
    '!esbuild.config.mjs'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapping: {
    '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
    '^codemirror$': '<rootDir>/tests/__mocks__/codemirror.ts',
    '^codemirror/mode/clike/clike$': '<rootDir>/tests/__mocks__/codemirror-clike.ts'
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'es6',
        module: 'commonjs',
        lib: ['es6', 'dom'],
        skipLibCheck: true
      }
    }
  }
};
import nextJest from "next/jest"
import type { Config } from "jest"

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
})

// Add any custom config to be passed to Jest
const customJestConfig: Config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@t3-oss/env-nextjs$": "<rootDir>/src/__mocks__/env-nextjs.ts",
    "^@/env$": "<rootDir>/src/__mocks__/env.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  globalSetup: "<rootDir>/jest.global-setup.ts",
  globalTeardown: "<rootDir>/jest.global-teardown.ts",
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig)

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
    // Next aliases `server-only` at build time; Jest has no such alias, so map
    // it to the no-op module that is used outside the client bundle.
    "^server-only$":
      "<rootDir>/node_modules/next/dist/compiled/server-only/empty.js",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  globalSetup: "<rootDir>/jest.global-setup.ts",
  globalTeardown: "<rootDir>/jest.global-teardown.ts",
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
}

const createConfig = createJestConfig(customJestConfig)

// next-safe-action ships ESM only, and next/jest ignores every node_modules
// path for transformation (a custom pattern cannot opt a package back in), so
// override the resolved patterns to transform it. Needed by the `eventAction`
// tests, which run the real client.
const config = async (): Promise<Config> => {
  const resolved = await createConfig()
  return {
    ...resolved,
    transformIgnorePatterns: [
      "/node_modules/(?!(next-safe-action)/)",
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  }
}

export default config

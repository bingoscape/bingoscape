// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom"

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  useParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => ""),
  useSearchParams: jest.fn(() => ({ get: () => null })),
}))

// Mock env to avoid ESM issues with @t3-oss
jest.mock("@/env", () => require("./src/__mocks__/env"))

// Mock database to support transactional tests
jest.mock("@/server/db", () => {
  const original = jest.requireActual("@/server/db")
  return {
    __esModule: true,
    ...original,
    get db() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (globalThis as any).__TEST_TX__ || original.db
    },
  }
})

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

declare global {
   
  var __TEST_TX__: unknown
}

// Mock database to support transactional tests
jest.mock("@/server/db", () => {
  const original = jest.requireActual("@/server/db")
  return {
    __esModule: true,
    db: new Proxy(original.db, {
      get(target, prop) {
         
        const activeDb = globalThis.__TEST_TX__ || target
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value = (activeDb as any)[prop]
        return typeof value === "function" ? value.bind(activeDb) : value
      }
    }),
  }
})

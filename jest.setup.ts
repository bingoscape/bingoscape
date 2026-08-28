// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom"
import { TextDecoder, TextEncoder } from "util"
import { ReadableStream } from "stream/web"

// Polyfill for Next.js / web streams in Jest
// (Next imports expect these globals to exist)
global.TextEncoder = TextEncoder as any
global.TextDecoder = TextDecoder as any
global.ReadableStream = ReadableStream as any

// Next.js server helpers can pull in Node/Edge request globals; in unit tests
// we don't need them, so we mock the module to avoid those heavy imports.
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
  unstable_cache: (fn: any) => fn,
}))

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

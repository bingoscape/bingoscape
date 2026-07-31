import { db } from "@/server/db"

class RollbackError extends Error {
  constructor() {
    super("Rollback Error")
    this.name = "RollbackError"
  }
}

/**
 * Wraps a test in a database transaction and rolls it back at the end.
 * The test transaction is automatically injected into all imports of `@/server/db`
 * thanks to the mock in `jest.setup.ts`.
 */
export async function withDb(testFn: () => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      // Inject transaction into the global context for the db mock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).__TEST_TX__ = tx
      
      await testFn()
      
      // Force a rollback
      throw new RollbackError()
    })
  } catch (err) {
    if (err instanceof RollbackError) {
      // Expected rollback
      return
    }
    throw err
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).__TEST_TX__ = undefined
  }
}

export default async function globalTeardown() {
  console.log("Stopping Jest PostgreSQL container...")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const container = (globalThis as any).__JEST_DB_CONTAINER__
  if (container) {
    await container.stop()
  }
}

export default async function globalTeardown() {
  console.log("Stopping Jest PostgreSQL container...")
  const container = globalThis.__JEST_DB_CONTAINER__
  if (container) {
    await container.stop()
  }
}

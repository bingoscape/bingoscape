import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync } from "child_process"

export default async function globalSetup() {
  console.log("Starting Jest PostgreSQL container...")
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("bingoscape_test")
    .start()

  const dbUrl = container.getConnectionUri()
  process.env.DATABASE_URL = dbUrl
  process.env.SKIP_ENV_VALIDATION = "1"

  console.log(`Jest Database started at ${dbUrl}`)
  
  console.log("Pushing database schema...")
  execSync("npx drizzle-kit push", {
    env: { ...process.env },
    stdio: "inherit",
  })

  // Store globally to stop them in teardown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).__JEST_DB_CONTAINER__ = container
}

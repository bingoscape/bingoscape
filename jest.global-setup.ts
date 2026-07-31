import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql"

declare global {
   
  var __JEST_DB_CONTAINER__: StartedPostgreSqlContainer
}
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
  globalThis.__JEST_DB_CONTAINER__ = container
}

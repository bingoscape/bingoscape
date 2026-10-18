import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql"

declare global {
   
  var __JEST_DB_CONTAINER__: StartedPostgreSqlContainer
}
import { execSync } from "child_process"

export default async function globalSetup() {
  console.log("Starting Jest PostgreSQL container...")
  // Every test file opens its own connection pool (up to 10 connections) and
  // jest workers outlive their files, so with many files and cores the default
  // 100 connections run out ("too many clients already").
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("bingoscape_test")
    .withCommand(["postgres", "-c", "max_connections=500"])
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

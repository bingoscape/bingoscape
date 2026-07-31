import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { ChildProcessWithoutNullStreams, execSync, spawn } from "child_process"

declare global {
  var __DB_CONTAINER__: StartedPostgreSqlContainer;
  var __NEXT_PROCESS__: ChildProcessWithoutNullStreams;
}

export default async function globalSetup() {
  console.log("Starting PostgreSQL container...")
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("bingoscape_test")
    .start()

  const dbUrl = container.getConnectionUri()
  process.env.DATABASE_URL = dbUrl
  process.env.NEXTAUTH_URL = "http://localhost:3001"
  process.env.DISCORD_CLIENT_ID = "dummy"
  process.env.DISCORD_CLIENT_SECRET = "dummy"
  process.env.SKIP_ENV_VALIDATION = "1"

  console.log(`Database started at ${dbUrl}`)
  
  console.log("Pushing database schema...")
  execSync("npx drizzle-kit push", {
    env: { ...process.env },
    stdio: "inherit",
  })

  // 3. Start Next.js dev server on port 3001
  console.log("Starting Next.js dev server on port 3001...");
  const nextProcess = spawn("npx", ["next", "dev", "-p", "3001"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SKIP_ENV_VALIDATION: "1",
      DATABASE_URL: dbUrl,
      NEXT_TELEMETRY_DISABLED: "1",
      OTEL_SDK_DISABLED: "1",
    },
    shell: true,
  });

  // Wait for the server to be ready
  await new Promise<void>((resolve, reject) => {
    let isReady = false;
    nextProcess.stdout.on("data", (data) => {
      const dataStr = data.toString();
      console.log(`[Next.js] ${dataStr.trim()}`);
      // Wait for Next.js to indicate it's ready
      if (dataStr.includes("Ready in") || dataStr.includes("ready on") || dataStr.includes("compiled")) {
        if (!isReady) {
          isReady = true;
          console.log("Next.js server is ready on port 3001.");
          resolve();
        }
      }
    });
    nextProcess.stderr?.on("data", (data) => {
      console.error(`Next.js error: ${data}`)
    })
    nextProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Next.js process exited with code ${code}.`))
      }
    })
  })

  // Store globally to stop them in teardown
  ;(globalThis).__DB_CONTAINER__ = container
  ;(globalThis).__NEXT_PROCESS__ = nextProcess
}

import { execSync } from "child_process"

export default async function globalTeardown() {
  console.log("Tearing down Playwright environment...")

  const nextProcess = (globalThis).__NEXT_PROCESS__
  if (nextProcess) {
    console.log("Stopping Next.js server...")
    // On Windows, tree kill is often needed
    if (process.platform === "win32") {
      try {
        execSync(`taskkill /pid ${nextProcess.pid} /T /F`)
      } catch (e) {
        console.error(`Failed to kill Next.js process (gracefully ignoring):`, e)
      }
    } else {
      nextProcess.kill("SIGINT")
    }
  }

  const container = (globalThis).__DB_CONTAINER__
  if (container) {
    console.log("Stopping PostgreSQL container...")
    await container.stop()
  }
}

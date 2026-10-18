/**
 * Runs once when the Next.js server starts. Starts the team draft's pick timer
 * sweeper (team draft 3/4, #217), which also resolves the turns that expired
 * while the app was down or being deployed. Only in the long-lived Node
 * server: not in the Edge runtime and not while `next build` collects pages.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDraftSweeperOnBoot } =
      await import("@/server/draft/sweeper-boot")
    startDraftSweeperOnBoot()
  }
}

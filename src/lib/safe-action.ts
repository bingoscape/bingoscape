import { createSafeActionClient } from "next-safe-action"
import { getServerAuthSession } from "@/server/auth"

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof Error) {
      return e.message
    }
    return "An unexpected error occurred"
  },
})

export const authenticatedAction = actionClient.use(async ({ next }) => {
  const session = await getServerAuthSession()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  return next({ ctx: { user: session.user } })
})

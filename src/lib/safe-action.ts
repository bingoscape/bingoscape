import { createSafeActionClient } from "next-safe-action"
import { logger } from "@/lib/logger"
import { UserFacingError } from "@/lib/user-facing-error"
import { getServerAuthSession } from "@/server/auth"
import { AuthzError } from "@/server/authz/errors"

export const actionClient = createSafeActionClient({
  // Only messages written for the user leave the server. A driver error
  // carries the SQL text and its parameters (drizzle-orm >= 0.44).
  handleServerError(e) {
    if (e instanceof UserFacingError || e instanceof AuthzError) {
      return e.message
    }
    logger.error({ error: e }, "Unexpected server action error")
    return "An unexpected error occurred"
  },
})

export const authenticatedAction = actionClient.use(async ({ next }) => {
  const session = await getServerAuthSession()

  if (!session?.user) {
    throw new UserFacingError("Unauthorized")
  }

  return next({ ctx: { user: session.user } })
})

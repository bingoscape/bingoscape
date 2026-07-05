import { getServerAuthSession } from "@/server/auth"
import { logger } from "@/lib/logger"

// Configuration for super admins - you can move this to an environment variable or config file
const SUPER_ADMIN_EMAILS = [
  // Add super admin emails here
  // You can also use environment variables
  ...(process.env.SUPER_ADMIN_EMAILS?.split(",") ?? []),
]

export async function isSuperAdmin(): Promise<boolean> {
  const session = await getServerAuthSession()

  if (!session?.user?.email) {
    return false
  }

  return SUPER_ADMIN_EMAILS.includes(session.user.email)
}

export async function requireSuperAdmin() {
  const isAdmin = await isSuperAdmin()

  if (!isAdmin) {
    const session = await getServerAuthSession()
    logger.warn({
      userId: session?.user?.id,
      email: session?.user?.email,
      action: "requireSuperAdmin"
    }, "Unauthorized access attempt to super-admin restricted action")
    throw new Error("Super admin access required")
  }
}

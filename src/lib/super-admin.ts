import { getServerAuthSession } from "@/server/auth"

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
    throw new Error("Super admin access required")
  }
}

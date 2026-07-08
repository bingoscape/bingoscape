import type React from "react"
import { isSuperAdmin } from "@/lib/super-admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Users, Shield, Calendar, BarChart3, Home } from "lucide-react"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isAdmin = await isSuperAdmin()

  if (!isAdmin) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Super Admin Panel</h1>
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="mr-2 h-4 w-4" />
                Back to App
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          <aside className="w-64 space-y-2">
            <nav className="space-y-1">
              <Link href="/super-admin">
                <Button variant="ghost" className="w-full justify-start">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/super-admin/users">
                <Button variant="ghost" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Users
                </Button>
              </Link>
              <Link href="/super-admin/clans">
                <Button variant="ghost" className="w-full justify-start">
                  <Shield className="mr-2 h-4 w-4" />
                  Clans
                </Button>
              </Link>
              <Link href="/super-admin/events">
                <Button variant="ghost" className="w-full justify-start">
                  <Calendar className="mr-2 h-4 w-4" />
                  Events
                </Button>
              </Link>
            </nav>
          </aside>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}

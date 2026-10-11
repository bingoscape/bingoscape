import type React from "react"
import { notFound } from "next/navigation"

import { AdminNav } from "@/components/super-admin/admin-nav"
import { isSuperAdmin } from "@/lib/super-admin"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Non-admins get a 404 rather than a redirect, so the area does not advertise itself.
  if (!(await isSuperAdmin())) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-4 lg:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <AdminNav />
        <main id="admin-main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}

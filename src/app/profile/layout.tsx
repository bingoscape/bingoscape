import type React from "react"
import type { Metadata } from "next"
import { getServerAuthSession } from "@/server/auth"
import { redirect } from "next/navigation"
import { ProfileNavigation } from "@/components/profile-navigation"

export const metadata: Metadata = {
  title: "Profile | BingoScape",
  description: "Manage your BingoScape profile",
}

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerAuthSession()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="container mx-auto py-10 max-w-5xl">
      <ProfileNavigation />
      {children}
    </div>
  )
}

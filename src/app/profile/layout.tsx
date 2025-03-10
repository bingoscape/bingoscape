import type React from "react"
import type { Metadata } from "next"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { getServerAuthSession } from "@/server/auth"
import { redirect } from "next/navigation"

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
    <div className="container mx-auto py-10">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <Link href="/profile" passHref>
            <TabsTrigger value="profile" asChild>
              <div className="w-full cursor-pointer">Profile</div>
            </TabsTrigger>
          </Link>
          <Link href="/profile/api-keys" passHref>
            <TabsTrigger value="api-keys" asChild>
              <div className="w-full cursor-pointer">API Keys</div>
            </TabsTrigger>
          </Link>
        </TabsList>
        <Card className="mt-6 p-6">{children}</Card>
      </Tabs>
    </div>
  )
}


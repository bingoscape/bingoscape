import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { UpdateRsnForm } from "@/components/update-rsn-form"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"

async function getUser(userId: string) {
  const user = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      runescapeName: users.runescapeName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user[0]
}

export default async function ProfilePage() {
  const session = await getServerAuthSession()

  if (!session || !session.user) {
    notFound()
  }

  const user = await getUser(session.user.id)

  if (!user) {
    notFound()
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
      <UpdateRsnForm user={user} />
    </div>
  )
}

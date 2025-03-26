import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { UpdateRsnForm } from "@/components/update-rsn-form"
import { WomProfileSection } from "@/components/wom-profile-section"
import { WomEventsSection } from "@/components/wom-events-section"
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

  const womLinked = !!user.runescapeName

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Your Profile</h1>

      <div className="grid gap-8">
        <UpdateRsnForm user={user} />

        <WomProfileSection userId={user.id} runescapeName={user.runescapeName} womLinked={womLinked} />

        <WomEventsSection userId={user.id} runescapeName={user.runescapeName} womLinked={womLinked} />
      </div>
    </div>
  )
}


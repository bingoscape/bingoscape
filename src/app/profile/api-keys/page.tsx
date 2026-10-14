import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { apiKeyStatus } from "@/lib/api-key"
import { ApiKeyManager } from "@/components/api-key-manager"

export default async function ApiKeysPage() {
  const session = await getServerAuthSession()

  if (!session?.user) {
    redirect("/login")
  }

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      description: apiKeys.description,
      createdAt: apiKeys.createdAt,
      lastUsed: apiKeys.lastUsed,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id))
    .orderBy(apiKeys.createdAt)

  // Convert dates to string for serialization from server to client
  const serializedKeys = keys.map((k) => ({
    ...k,
    createdAt: k.createdAt.toISOString(),
    lastUsed: k.lastUsed?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    status: apiKeyStatus(k),
  }))

  return (
    <div className="space-y-6">
      <ApiKeyManager initialKeys={serializedKeys} />
    </div>
  )
}

import { createAuthClient } from "better-auth/react"
import {
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins"

import type { auth } from "@/server/auth"

/** Better Auth on the client: same origin, `/api/auth`. */
export const authClient = createAuthClient({
  plugins: [usernameClient(), inferAdditionalFields<typeof auth>()],
})

export const { signIn, signOut, useSession } = authClient

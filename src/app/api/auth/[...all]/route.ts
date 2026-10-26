import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/server/auth"

const { GET, POST } = toNextJsHandler(auth)
export { GET, POST }

import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

import { cspHeader, parseCspMode } from "@/lib/security-headers"

const PROTECTED = ["/events", "/clans", "/profile", "/super-admin", "/templates"]

export async function proxy(request: NextRequest) {
  const startTime = Date.now()
  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))
  if (isProtected) {
    const token = await getToken({ req: request })
    if (!token) {
      const signIn = new URL("/sign-in", request.url)
      // Keep the query string so deep links like /clans/join?code=... survive sign-in.
      signIn.searchParams.set("callbackUrl", pathname + request.nextUrl.search)
      return NextResponse.redirect(signIn)
    }
  }
  const response = NextResponse.next()
  response.headers.set("X-Response-Time", `${Date.now() - startTime}ms`)
  // CSP_MODE is read per request, so changing it only needs a restart.
  const csp = cspHeader(parseCspMode(process.env.CSP_MODE), {
    isDev: process.env.NODE_ENV !== "production",
  })
  if (csp) response.headers.set(csp.key, csp.value)
  return response
}

// Configure which routes use middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}


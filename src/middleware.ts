import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function middleware(_request: NextRequest) {
  const startTime = Date.now()

  // Clone the request to allow reading the body if needed
  const response = NextResponse.next()

  // Add timing header
  response.headers.set("X-Response-Time", `${Date.now() - startTime}ms`)

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

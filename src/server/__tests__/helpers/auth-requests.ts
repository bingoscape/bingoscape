import { auth } from "@/server/auth"

const BASE = "http://localhost:3000/api/auth"

/** The `name=value` pairs of a response's Set-Cookie headers, as a Cookie header. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
}

/** A request through Better Auth's HTTP handler, as the browser sends it. */
export function authRequest(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; ip?: string } = {}
): Promise<Response> {
  const headers = new Headers({ origin: "http://localhost:3000" })
  if (init.body !== undefined) headers.set("content-type", "application/json")
  if (init.cookie) headers.set("cookie", init.cookie)
  if (init.ip) headers.set("x-forwarded-for", init.ip)
  return auth.handler(
    new Request(`${BASE}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  )
}

/** Signs in through `/sign-in/username`; the session cookie on success. */
export async function signInByUsername(
  username: string,
  password: string,
  ip?: string
): Promise<{ status: number; cookie: string; body: { code?: string } }> {
  const response = await authRequest("/sign-in/username", {
    body: { username, password },
    ip,
  })
  return {
    status: response.status,
    cookie: cookieHeader(response),
    body: (await response.json()) as { code?: string },
  }
}

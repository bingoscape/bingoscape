/**
 * Response security headers (RBAC 7/8, #190).
 *
 * Plain ESM JavaScript so `next.config.mjs` can import it (it runs before any
 * TypeScript is compiled) and the tests can import it through `@/lib`.
 *
 * - `STATIC_SECURITY_HEADERS` (nosniff, Referrer-Policy) go out through the
 *   `headers()` of next.config.mjs, on every response including static files.
 * - The Content-Security-Policy is attached per request by `src/proxy.ts`
 *   instead, because next.config headers are frozen at build time and the
 *   Docker image is built without runtime env: the mode below has to be
 *   switchable by restarting the container.
 */

/**
 * CSP mode, from the `CSP_MODE` env var:
 * - `report-only` (default) sends `Content-Security-Policy-Report-Only`: the
 *   browser logs violations in its console and blocks nothing. Shipped as the
 *   default because the policy was not verified against every page of the
 *   running app.
 * - `enforce` sends `Content-Security-Policy`.
 * - `off` sends neither.
 * @typedef {"report-only" | "enforce" | "off"} CspMode
 */

/**
 * @param {string | undefined} raw
 * @returns {CspMode}
 */
export function parseCspMode(raw) {
  const value = raw?.trim().toLowerCase()
  if (value === "enforce" || value === "off") return value
  return "report-only"
}

/** Hosts the browser loads images from or talks to besides the app itself. */
const WIKI_HOSTS = ["https://oldschool.runescape.wiki", "https://runescape.wiki"]

/**
 * The policy. Why each source:
 * - `script-src 'unsafe-inline'`: Next.js inlines its bootstrap/flight data
 *   and next-themes inlines the theme script; a nonce-based policy would need
 *   dynamic rendering of every page. (`'unsafe-eval'` only in development, for
 *   React's debugging tools.)
 * - `style-src 'unsafe-inline'`: Tailwind/Radix/Recharts set inline styles.
 * - `img-src https:`: Tile and Event images come from the uploads, the OSRS
 *   wiki, Discord/GitHub avatars and Markdown descriptions that may embed any
 *   https image. Images cannot run script.
 * - `connect-src`: the app plus the wiki API the Tile editor queries from the
 *   browser (CORS, `origin=*`).
 * - no `form-action`: NextAuth sign-in posts a same-origin form that redirects
 *   to the OAuth provider, which Chrome checks against `form-action`.
 *
 * @param {{ isDev?: boolean }} [options]
 * @returns {string}
 */
export function buildContentSecurityPolicy(options = {}) {
  const scriptSrc = ["'self'", "'unsafe-inline'"]
  if (options.isDev) scriptSrc.push("'unsafe-eval'")

  const directives = [
    ["default-src", "'self'"],
    ["script-src", scriptSrc.join(" ")],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", "'self' data: blob: https:"],
    ["font-src", "'self' data:"],
    ["connect-src", ["'self'", ...WIKI_HOSTS].join(" ")],
    ["media-src", "'self'"],
    ["worker-src", "'self' blob:"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["frame-ancestors", "'self'"],
  ]
  return directives.map(([name, value]) => `${name} ${value}`).join("; ")
}

/**
 * The CSP header for a mode, or null when it is off.
 * @param {CspMode} mode
 * @param {{ isDev?: boolean }} [options]
 * @returns {{ key: string; value: string } | null}
 */
export function cspHeader(mode, options = {}) {
  if (mode === "off") return null
  return {
    key:
      mode === "enforce"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
    value: buildContentSecurityPolicy(options),
  }
}

/** Headers that are safe on every response and never depend on runtime env. */
export const STATIC_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]

/** The `headers()` of next.config.mjs. */
export async function securityHeaders() {
  return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }]
}

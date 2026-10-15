/**
 * @jest-environment node
 */
import fs from "node:fs"
import path from "node:path"

import { WIKI_HOSTS } from "@/lib/wiki-hosts"
import {
  STATIC_SECURITY_HEADERS,
  buildContentSecurityPolicy,
  cspHeader,
  parseCspMode,
  securityHeaders,
} from "@/lib/security-headers"

describe("security headers", () => {
  it("sends nosniff and a Referrer-Policy on every path", async () => {
    const rules = await securityHeaders()
    expect(rules).toHaveLength(1)
    expect(rules[0]!.source).toBe("/:path*")
    const headers = Object.fromEntries(rules[0]!.headers.map((h) => [h.key, h.value]))
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
    expect(rules[0]!.headers).toEqual(STATIC_SECURITY_HEADERS)
  })

  it("is wired into next.config.mjs", () => {
    const config = fs.readFileSync(
      path.resolve(__dirname, "../../../next.config.mjs"),
      "utf8"
    )
    expect(config).toContain('from "./src/lib/security-headers.js"')
    expect(config).toMatch(/headers:\s*securityHeaders/)
  })

  it("sends the CSP from the proxy", () => {
    const proxy = fs.readFileSync(path.resolve(__dirname, "../../proxy.ts"), "utf8")
    expect(proxy).toContain("cspHeader(")
    expect(proxy).toContain("process.env.CSP_MODE")
  })
})

describe("Content-Security-Policy", () => {
  it("defaults to report-only and parses the modes", () => {
    expect(parseCspMode(undefined)).toBe("report-only")
    expect(parseCspMode("")).toBe("report-only")
    expect(parseCspMode("nonsense")).toBe("report-only")
    expect(parseCspMode("enforce")).toBe("enforce")
    expect(parseCspMode(" ENFORCE ")).toBe("enforce")
    expect(parseCspMode("off")).toBe("off")
  })

  it("picks the header name by mode", () => {
    expect(cspHeader("enforce")!.key).toBe("Content-Security-Policy")
    expect(cspHeader("report-only")!.key).toBe("Content-Security-Policy-Report-Only")
    expect(cspHeader("off")).toBeNull()
  })

  it("allows what the app needs and locks down the rest", () => {
    const csp = buildContentSecurityPolicy()
    const directive = (name: string) =>
      csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? ""

    expect(directive("default-src")).toBe("default-src 'self'")
    // Next.js and next-themes inline scripts.
    expect(directive("script-src")).toContain("'unsafe-inline'")
    expect(directive("script-src")).not.toContain("'unsafe-eval'")
    expect(directive("style-src")).toContain("'unsafe-inline'")
    // Uploads, avatars and wiki images.
    expect(directive("img-src")).toContain("'self'")
    expect(directive("img-src")).toContain("https:")
    expect(directive("img-src")).toContain("data:")
    // The wiki image search runs on the server: the browser only talks to the app.
    expect(directive("connect-src")).toBe("connect-src 'self'")
    expect(directive("object-src")).toBe("object-src 'none'")
    expect(directive("base-uri")).toBe("base-uri 'self'")
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'self'")
    // NextAuth redirects a same-origin form to the OAuth provider.
    expect(csp).not.toContain("form-action")
  })

  it("adds unsafe-eval only in development", () => {
    expect(buildContentSecurityPolicy({ isDev: true })).toContain("'unsafe-eval'")
    expect(buildContentSecurityPolicy({ isDev: false })).not.toContain(
      "'unsafe-eval'"
    )
  })

  it("covers every remote image host configured in next.config.mjs", () => {
    const config = fs.readFileSync(
      path.resolve(__dirname, "../../../next.config.mjs"),
      "utf8"
    )
    const hosts = [...config.matchAll(/hostname: "([^"]+)"/g)].map((m) => m[1])
    expect(hosts.length).toBeGreaterThan(0)
    // img-src allows every https host, which includes all of them.
    expect(buildContentSecurityPolicy()).toContain("img-src 'self' data: blob: https:")
  })

  it("names no wiki host, so the OSRS_IMAGE_PROXY=false rollback needs no CSP change", () => {
    const csp = buildContentSecurityPolicy()
    for (const host of WIKI_HOSTS) expect(csp).not.toContain(host)
    // The wiki images are served by the app itself now (same origin) ...
    expect(csp).toContain("img-src 'self'")
    // ... and with the flag off, wiki URLs are still covered by https:.
    expect(csp).toContain("https:")
  })

  it("keeps the wiki hosts in remotePatterns: the optimiser needs them for the rollback and RS3", () => {
    const config = fs.readFileSync(
      path.resolve(__dirname, "../../../next.config.mjs"),
      "utf8"
    )
    // remotePatterns is frozen at build time and cannot follow the runtime
    // OSRS_IMAGE_PROXY flag, so the OSRS host stays (next/image would answer
    // 400 for wiki URLs when the flag is off); RS3 images are not cached.
    expect(config).toMatch(/hostname: OSRS_WIKI_HOST/)
    expect(config).toMatch(/hostname: RS3_WIKI_HOST/)
  })
})

describe("proxy", () => {
  const original = process.env.CSP_MODE

  afterEach(() => {
    if (original === undefined) delete process.env.CSP_MODE
    else process.env.CSP_MODE = original
  })

  async function run(mode: string | undefined) {
    if (mode === undefined) delete process.env.CSP_MODE
    else process.env.CSP_MODE = mode
    const { NextRequest } = await import("next/server")
    const { proxy } = await import("@/proxy")
    return proxy(new NextRequest("http://localhost:3000/"))
  }

  it("sends the policy as report-only by default", async () => {
    const response = await run(undefined)
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain(
      "default-src 'self'"
    )
    expect(response.headers.get("Content-Security-Policy")).toBeNull()
  })

  it("enforces it when CSP_MODE=enforce and sends nothing when off", async () => {
    const enforced = await run("enforce")
    expect(enforced.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
    expect(enforced.headers.get("Content-Security-Policy-Report-Only")).toBeNull()

    const off = await run("off")
    expect(off.headers.get("Content-Security-Policy")).toBeNull()
    expect(off.headers.get("Content-Security-Policy-Report-Only")).toBeNull()
  })
})

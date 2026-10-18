import { securityHeaders } from "./src/lib/security-headers.js"
import { OSRS_WIKI_HOST, RS3_WIKI_HOST } from "./src/lib/wiki-hosts.js"

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js")

/** @type {import("next").NextConfig} */
const config = {
  // Enable standalone output for optimized Docker builds
  output: "standalone",

  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
      proxyBodySizeLimit: "25mb",
    },
  },
  turbopack: {},
  images: {
    // dangerouslyAllowSVG removed (H7): SVG files with embedded JS could be
    // served through the optimizer.  Only raster formats are needed.
    remotePatterns: [
      // Discord OAuth profile pictures
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "avatars.discordapp.com" },
      // GitHub OAuth profile pictures
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Old School RuneScape wiki images. With the image cache on
      // (OSRS_IMAGE_PROXY, the default) the app renders them from
      // /api/osrs-image/..., so nothing is optimised from this host. The entry
      // stays for the rollback flag: with OSRS_IMAGE_PROXY=false stored wiki
      // URLs are rendered as they are, and the optimiser of every <Image> that
      // is not `unoptimized` would answer 400 without it. remotePatterns is
      // frozen at build time, so it cannot follow the flag.
      { protocol: "https", hostname: OSRS_WIKI_HOST },
      // RuneScape 3 wiki images (still hotlinked, not cached)
      { protocol: "https", hostname: RS3_WIKI_HOST },
    ],
  },
  // nosniff and Referrer-Policy; the CSP is added per request by src/proxy.ts.
  headers: securityHeaders,
  async rewrites() {
    return [
      {
        source: "/uploads/:path",
        destination: "/api/uploads/:path",
      },
    ]
  },
}

export default config

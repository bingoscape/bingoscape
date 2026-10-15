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
      // Old School RuneScape wiki images (tile header images, frog images, etc.)
      { protocol: "https", hostname: OSRS_WIKI_HOST },
      // RuneScape 3 wiki images
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

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
  // Empty turbopack config to indicate we're aware of the Turbopack default
  // The webpack config below is kept for backwards compatibility
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        { message: /Package import-in-the-middle can't be external/ },
      ]
    }
    return config
  },
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
      { protocol: "https", hostname: "oldschool.runescape.wiki" },
      // RuneScape 3 wiki images
      { protocol: "https", hostname: "runescape.wiki" },
    ],
  },
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

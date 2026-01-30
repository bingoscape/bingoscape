/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js")

/** @type {import("next").NextConfig} */
const config = {
  // Enable standalone output for optimized Docker builds
  output: "standalone",

  // Enable OpenTelemetry instrumentation
  experimental: {
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: "10mb",
      proxyBodySizeLimit: "10mb",
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
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        pathname: "**",
        port: "",
      },
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

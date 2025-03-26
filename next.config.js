await import("./src/env.js")

/** @type {import("next").NextConfig} */
const config = {
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


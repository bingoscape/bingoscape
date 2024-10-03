/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        pathname: "**",
        port: '',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path',
        destination: '/api/uploads/:path'
      }
    ]
  }
};

export default config;

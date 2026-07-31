export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "postgres://test:test@localhost:32787/bingoscape_test",
  NODE_ENV: "test",
  NEXTAUTH_SECRET: "test-secret",
  NEXTAUTH_URL: "http://localhost:3000",
  DISCORD_CLIENT_ID: "test-client-id",
  DISCORD_CLIENT_SECRET: "test-client-secret",
}

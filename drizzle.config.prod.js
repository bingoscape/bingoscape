// Production drizzle config - uses environment variables directly
// This avoids TypeScript path alias issues in production

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  tablesFilter: ["bingoscape-next_*"],
};

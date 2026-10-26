import { env as testEnv } from "./env"

// next/jest compiles `@/` imports to relative paths (SWC `paths`), so the
// `^@/env$` mapper never applies and `src/env.js` runs with this mock. Return
// the fixed test env instead of `runtimeEnv` (raw process.env), so tests do
// not depend on a local `.env`.
export const createEnv = () => testEnv

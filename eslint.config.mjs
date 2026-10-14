import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  },
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    // eslint-plugin-react-hooks 7.1 (pulled in by eslint-config-next 16.4)
    // started reporting set-state-in-effect as an error. About 20 existing
    // components still load data or reset form state inside effects; fixing
    // them means restructuring those components (server-side data fetching,
    // key-based resets), which is out of scope for the Next.js upgrade and
    // should be done in a separate change. Keep the rule visible as a warning
    // until then.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]

export default eslintConfig

import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

// RBAC guard rails (epic #183, issue #191).
//
// 1. Nobody compares a role string. Who may do what is decided once, in the
//    policy (`src/lib/authz`, `src/server/authz`): server code asks `authorize`,
//    `requirePermission`, `hasPermission` or `can`; UI components get
//    `EventCapabilities` as props.
// 2. A relation to a user in a Drizzle relational query must name its columns
//    (`columns: PUBLIC_USER_COLUMNS` from `@/server/db/public-user`), because a
//    full `users` row carries the password hash, email and session state.
const ROLE_LITERAL = "/^(admin|management)$/"
const ROLE_MESSAGE =
  "Do not compare a role string. Ask the policy (authorize / requirePermission / hasPermission / can in @/server/authz or @/lib/authz) or use the capabilities passed as props."
const USER_RELATIONS = "/^(user|creator|reviewer|author)$/"
const USER_COLUMNS_MESSAGE =
  "A user relation in a relational query needs explicit `columns` (use `columns: PUBLIC_USER_COLUMNS` from @/server/db/public-user); `user: true` loads the password hash."

const USER_COLUMNS_RULES = [
  {
    selector: `Property[key.name="with"] > ObjectExpression > Property[key.name=${USER_RELATIONS}][value.type="Literal"][value.value=true]`,
    message: USER_COLUMNS_MESSAGE,
  },
  {
    selector: `Property[key.name="with"] > ObjectExpression > Property[key.name=${USER_RELATIONS}] > ObjectExpression:not(:has(> Property[key.name="columns"]))`,
    message: USER_COLUMNS_MESSAGE,
  },
]

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
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `BinaryExpression[operator=/^[!=]==?$/][left.value=${ROLE_LITERAL}]`,
          message: ROLE_MESSAGE,
        },
        {
          selector: `BinaryExpression[operator=/^[!=]==?$/][right.value=${ROLE_LITERAL}]`,
          message: ROLE_MESSAGE,
        },
        {
          selector: `SwitchCase[test.value=${ROLE_LITERAL}]`,
          message: ROLE_MESSAGE,
        },
        {
          selector: `CallExpression[callee.property.name=/^(includes|indexOf)$/] > Literal.arguments[value=${ROLE_LITERAL}]`,
          message: ROLE_MESSAGE,
        },
        {
          selector: `CallExpression[callee.property.name=/^(includes|indexOf|some)$/] > MemberExpression.callee > ArrayExpression.object > Literal[value=${ROLE_LITERAL}]`,
          message: ROLE_MESSAGE,
        },
        {
          selector: `ArrayExpression:has(> Literal[value="admin"]):has(> Literal[value="management"])`,
          message:
            "Do not spell out the manager roles. Use MANAGER_ROLES / isManagerRole from @/lib/authz/roles, or ask the policy.",
        },
        ...USER_COLUMNS_RULES,
      ],
    },
  },
  {
    // The policy itself is where role strings belong.
    files: ["src/lib/authz/**", "src/server/authz/**"],
    rules: {
      "no-restricted-syntax": ["error", ...USER_COLUMNS_RULES],
    },
  },
  {
    // The database enum definitions spell the roles out (the single source the
    // role types in src/lib/authz/roles.ts are derived from).
    files: ["src/server/db/schema.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...USER_COLUMNS_RULES],
    },
  },
  {
    // Tests name roles on purpose: fixtures, expected values, and the grep and
    // lint gates' own samples. They do not decide access.
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...USER_COLUMNS_RULES],
    },
  },
]

export default eslintConfig

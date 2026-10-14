// RBAC guard rails (epic #183, issue #191) as an oxlint JS plugin, because
// oxlint has no `no-restricted-syntax`.
//
// 1. `rbac/no-role-comparison`: nobody compares a role string. Who may do what
//    is decided once, in the policy (`src/lib/authz`, `src/server/authz`):
//    server code asks `authorize`, `requirePermission`, `hasPermission` or
//    `can`; UI components get `EventCapabilities` as props. The rule is turned
//    off for the policy, the schema and the tests in `.oxlintrc.json`.
// 2. `rbac/user-relation-columns`: a relation to a user in a Drizzle relational
//    query must name its columns (`columns: PUBLIC_USER_COLUMNS` from
//    `@/server/db/public-user`), because a full `users` row carries the
//    password hash, email and session state.

const ROLES = new Set(["admin", "management"])
const COMPARISON_OPERATORS = new Set(["==", "===", "!=", "!=="])
const SEARCH_METHODS = new Set(["includes", "indexOf", "some"])
const USER_RELATIONS = new Set(["user", "creator", "reviewer", "author"])

const ROLE_MESSAGE =
  "Do not compare a role string. Ask the policy (authorize / requirePermission / hasPermission / can in @/server/authz or @/lib/authz) or use the capabilities passed as props."
const MANAGER_PAIR_MESSAGE =
  "Do not spell out the manager roles. Use MANAGER_ROLES / isManagerRole from @/lib/authz/roles, or ask the policy."
const USER_COLUMNS_MESSAGE =
  "A user relation in a relational query needs explicit `columns` (use `columns: PUBLIC_USER_COLUMNS` from @/server/db/public-user); `user: true` loads the password hash."

const isRoleLiteral = (node) =>
  node?.type === "Literal" &&
  typeof node.value === "string" &&
  ROLES.has(node.value)

const keyName = (property) => {
  if (property?.type !== "Property" || property.computed) return undefined
  if (property.key.type === "Identifier") return property.key.name
  if (property.key.type === "Literal") return String(property.key.value)
  return undefined
}

const noRoleComparison = {
  meta: { type: "problem" },
  create(context) {
    return {
      BinaryExpression(node) {
        if (
          COMPARISON_OPERATORS.has(node.operator) &&
          (isRoleLiteral(node.left) || isRoleLiteral(node.right))
        ) {
          context.report({ node, message: ROLE_MESSAGE })
        }
      },
      SwitchCase(node) {
        if (isRoleLiteral(node.test)) {
          context.report({ node, message: ROLE_MESSAGE })
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (
          callee.type !== "MemberExpression" ||
          callee.computed ||
          callee.property.type !== "Identifier" ||
          !SEARCH_METHODS.has(callee.property.name)
        ) {
          return
        }
        const searchesRoleArray =
          callee.object.type === "ArrayExpression" &&
          callee.object.elements.some(isRoleLiteral)
        const searchesForRole =
          callee.property.name !== "some" && node.arguments.some(isRoleLiteral)
        if (searchesRoleArray || searchesForRole) {
          context.report({ node, message: ROLE_MESSAGE })
        }
      },
      ArrayExpression(node) {
        const literals = node.elements.filter(isRoleLiteral).map((n) => n.value)
        if (literals.includes("admin") && literals.includes("management")) {
          context.report({ node, message: MANAGER_PAIR_MESSAGE })
        }
      },
    }
  },
}

const userRelationColumns = {
  meta: { type: "problem" },
  create(context) {
    return {
      Property(node) {
        if (
          keyName(node) !== "with" ||
          node.value.type !== "ObjectExpression"
        ) {
          return
        }
        for (const relation of node.value.properties) {
          if (!USER_RELATIONS.has(keyName(relation))) continue
          const value = relation.value
          const bare = value.type === "Literal" && value.value === true
          const withoutColumns =
            value.type === "ObjectExpression" &&
            !value.properties.some((p) => keyName(p) === "columns")
          if (bare || withoutColumns) {
            context.report({ node: relation, message: USER_COLUMNS_MESSAGE })
          }
        }
      },
    }
  },
}

const plugin = {
  meta: { name: "rbac" },
  rules: {
    "no-role-comparison": noRoleComparison,
    "user-relation-columns": userRelationColumns,
  },
}

export default plugin

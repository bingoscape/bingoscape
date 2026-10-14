# Contributing to BingoScape Next

This guide covers how to set up the project, the conventions to follow, and how changes are reviewed. Coding conventions live in [AGENTS.md](../AGENTS.md). This document does not repeat them in full.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Contribution Process](#contribution-process)
- [Testing](#testing)
- [Database Changes](#database-changes)
- [Documentation](#documentation)
- [Getting Help](#getting-help)

## Prerequisites

- Node.js 24 and npm
- PostgreSQL 18, either installed locally or started with Docker
- Docker. `npm test` and `npm run test:e2e` start a PostgreSQL container through Testcontainers, so Docker must be running.
- Git and a GitHub account
- A Discord application for OAuth (`DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are required by `src/env.js`)

## Development Setup

1. Fork the repository on GitHub, then clone your fork and add the upstream remote.

   ```bash
   git clone git@github.com:YOUR_USERNAME/bingoscape.git
   cd bingoscape
   git remote add upstream git@github.com:bingoscape/bingoscape.git
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. Create the environment file. The npm scripts load `.env` through `env-cmd`.

   ```bash
   cp .env.example .env
   ```

   Required variables: `DATABASE_URL`, `NEXTAUTH_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`. `NEXTAUTH_SECRET` is required only when `NODE_ENV=production`. The full list is in the Configuration section of the [README](../README.md#configuration).

4. Start a database and apply the migrations.

   ```bash
   # Option A: local PostgreSQL
   createdb bingoscape

   # Option B: only the postgres service from docker-compose.yml
   # (user postgres, password postgres, database bingoscape)
   docker compose up -d postgres

   npm run db:migrate
   ```

   Set `DATABASE_URL` in `.env` to match the database you chose. `./start-database.sh` is a third option that starts a standalone container using the credentials from `.env`.

5. Start the development server and open http://localhost:3000.

   ```bash
   npm run dev
   ```

6. Check the setup.

   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   ```

## Code Standards

The authoritative rules are in [AGENTS.md](../AGENTS.md). Domain vocabulary (Event, Team, Board, Tile, Blind Tile, Submission, Goal, Tier) is defined in [CONTEXT.md](../CONTEXT.md). Use these terms in code, UI text and commit messages. The database calls a Board `bingos`.

### Formatting and linting

- Prettier (`prettier.config.js`) with `prettier-plugin-tailwindcss`: 2-space indentation, no semicolons, double quotes, trailing commas where valid in ES5 (`trailingComma: "es5"`), print width 80, LF line endings. Tailwind classes are sorted by the plugin.
- Linting uses [oxlint](https://oxc.rs/docs/guide/usage/linter) (`.oxlintrc.json`) with the rules of the former Next.js `core-web-vitals` and TypeScript ESLint presets: React, React Hooks (including the React Compiler rules), Next.js, jsx-a11y, import and typescript-eslint rules. Unused variables warn unless the name starts with `_`. Warnings are allowed, errors fail the lint run. oxlint is not type-aware.
- In the editor, install the oxlint extension (VS Code: `oxc.oxc-vscode`) to see lint results while typing.
- Run `npm run lint -- --fix` after making changes and `npx tsc --noEmit` before opening a pull request.
- Do not bypass oxlint or the type checker with `oxlint-disable` / `eslint-disable` comments or `@ts-ignore` unless it is a known false positive. A suppression needs a justification comment next to it. oxlint honors both comment styles; the existing suppressions still use `eslint-disable` with the ESLint rule names (`react-hooks/*`, `@typescript-eslint/*`).

### TypeScript

- Strict mode with `noUncheckedIndexedAccess`. Handle `undefined` from indexed access.
- Avoid `any`. Use proper types, or `unknown` with a type guard.
- Use Drizzle inference: `typeof table.$inferInsert` and `typeof table.$inferSelect`.
- Use `import type` for type-only imports and the `@/` alias for internal imports.
- Generate ids with `nanoid()`.
- Store monetary values (buy-ins, donations) as `bigint`.
- TypeScript 7 (the native compiler) is the single `typescript` dev dependency. `tsc`, `next build` and `npx tsc --noEmit` all use it. It does not ship the JavaScript compiler API, so tools that need that API (typescript-eslint, ts-node) must not be added; this is why linting uses oxlint and the Jest config is a plain `jest.config.mjs`.
- The `next` TypeScript language-service plugin in `tsconfig.json` is not loaded by TypeScript 7 (no plugin API). Next.js re-adds the entry on every build, so leave it in place.

### Naming and structure

- File names are kebab-case (`event-card.tsx`). Components are PascalCase, functions and variables are camelCase.
- shadcn/ui primitives live in `src/components/ui/`. Business components live in `src/components/`.
- Use `cn()` from `@/lib/utils` to merge class names.
- Props use an `interface ComponentNameProps { ... }`.

### Data fetching and state

- Fetch data in Server Components with direct Drizzle queries and pass it to Client Components as props. Client-side fetching in `useEffect` is not allowed, except for polling or real-time updates.
- Keep client state minimal: `useState` or `useReducer` for transient UI state, URL search parameters for state that is shared or bookmarked.
- Global state managers (Redux, Zustand and similar) are not allowed.

### Server actions

Server actions live in `src/app/actions/` with the `"use server"` directive. They follow this pattern:

- Authenticate and authorize first, using the helpers in `src/server/authz.ts` (for example `requireBingoAdmin`, `requireEventManager`, `assertTeamLeaderOrManager`). The helpers derive the Event from the database. Never trust an `eventId` sent by the client.
- Validate inputs and return early with an error object.
- Run all mutations inside `db.transaction()`.
- Call `revalidatePath()` for the affected pages after a successful mutation.
- Return `{ success: boolean, error?: string }` and do not throw. Log unexpected errors with `logger` from `@/lib/logger`.

```typescript
"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/server/db"
import { AuthzError, requireBingoAdmin } from "@/server/authz"
import { bingos } from "@/server/db/schema"
import { logger } from "@/lib/logger"

type ActionResult = { success: boolean; error?: string }

export async function renameBingo(
  bingoId: string,
  title: string
): Promise<ActionResult> {
  if (title.trim().length === 0) {
    return { success: false, error: "Title is required" }
  }

  try {
    const eventId = await requireBingoAdmin(bingoId)

    await db.transaction(async (tx) => {
      await tx
        .update(bingos)
        .set({ title: title.trim() })
        .where(eq(bingos.id, bingoId))
    })

    revalidatePath(`/events/${eventId}`, "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof AuthzError) {
      return { success: false, error: error.message }
    }
    logger.error({ error, bingoId }, "Error renaming bingo")
    return { success: false, error: "Failed to rename bingo" }
  }
}
```

A complete real example is `saveTeamShipPlacements` in `src/app/actions/battleship.ts`.

### Client components

- Wrap async calls in `try`/`catch` and show failures with `toast()` from `@/hooks/use-toast` using `variant: "destructive"`.
- Prefer optimistic UI updates.

### Database queries

Use Drizzle relational queries (`db.query.<table>.findFirst` with `with`) instead of several separate queries when you need related rows.

## Contribution Process

### Planning

- Check existing issues first. Open one if none exists and discuss the approach there.
- For new features, open an issue or discussion and wait for maintainer feedback before starting. Consider breaking changes, in particular for the RuneLite API, which must stay backward compatible.

### Branches

Branch from an up-to-date `main`. Branch names follow the history: `feat/<topic>` and `fix/<topic>`, for example `feat/battleship-board` and `fix/tier-board-edits`.

```bash
git checkout main
git pull upstream main
git checkout -b feat/your-topic

# keep the branch current
git fetch upstream
git rebase upstream/main
```

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.

```
feat(battleship): add the ship placement page
fix(tiers): unlock the next tier after board edits
fix(authz): scope reads and writes to the event
feat(runelite): check access, rate-limit and ETag the board endpoint
test(progression): cover tier visibility and the submit gate
docs(changelog): add the RuneLite 2.1 changes
perf(api-auth): write apiKeys.lastUsed at most once a minute
```

Types in use: `feat`, `fix`, `docs`, `test`, `perf`, `refactor`, `chore`. Scopes are free-form and name the area of the change. Frequent scopes in the history: `battleship`, `runelite`, `goals`, `tiers`, `progression`, `authz`, `board`, `readme`, `changelog`, `api`.

### Pull requests

CI (`.github/workflows/ci-cd.yml`) runs on every pull request to `main`: lint, `npx tsc --noEmit`, `npm test`, `docker compose config -q`, and a Docker build of the `runner` and `migrator` images. CI does not run the Playwright tests. Run them locally when your change affects user flows.

Before opening a pull request, run:

```bash
npm run lint -- --fix
npx tsc --noEmit
npm test            # Docker must be running
npm run test:e2e    # when user flows change; Docker and Chrome required
npm run build:ci
```

In the pull request:

- Use a descriptive title in Conventional Commits style and explain the motivation.
- Reference related issues, for example `Fixes #123`.
- Include screenshots for UI changes.
- Add or update tests. Bug fixes need a regression test.
- Update the documentation and the `[Unreleased]` section of [CHANGELOG.md](../CHANGELOG.md) when behavior changes.
- State whether the change includes a database migration.

There is no pull request template in `.github/`. At least one maintainer review is required.

## Testing

### Unit and integration tests (Jest)

- Run with `npm test`. Run one file with `npm test -- <path>`, or filter with `npm test -- --testNamePattern="<pattern>"`.
- Test files match `**/__tests__/**/*.test.[jt]s?(x)` and sit next to the code, for example `src/app/actions/__tests__/` and `src/components/__tests__/`.
- Jest global setup starts a `postgres:15-alpine` container (`jest.global-setup.ts`) and sets `DATABASE_URL` for the run.
- `@/env` and `@t3-oss/env-nextjs` are replaced by the mocks in `src/__mocks__/`.
- Server action tests usually mock `@/server/auth`, `@/server/db`, `next/cache` and `@/lib/logger` with `jest.mock()`. Use `@jest-environment node` for server code. See `src/app/actions/__tests__/bingo-authz.test.ts`.
- Mock the current date when a test depends on it.
- Use `screen.getBy*` for positive assertions in component tests.

```typescript
/**
 * @jest-environment node
 */
import { getServerAuthSession } from "@/server/auth"
import { renameBingo } from "@/app/actions/bingo-rename"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const session = getServerAuthSession as jest.Mock

describe("renameBingo", () => {
  it("rejects a signed-out caller", async () => {
    session.mockResolvedValue(null)

    const result = await renameBingo("bingo-1", "New title")

    expect(result).toEqual({ success: false, error: "Unauthorized" })
  })
})
```

The module `bingo-rename` above is illustrative. A signed-out caller gets `Unauthorized` from `requireSession` in `src/server/authz.ts`.

### End-to-end tests (Playwright)

- Run with `npm run test:e2e` (`test:e2e:ui` and `test:e2e:headed` are also available). Specs live in `tests/`.
- `tests/global.setup.ts` starts a PostgreSQL container, pushes the schema, and starts the app on `http://localhost:3001`. The tests use Chrome.
- `setupAuthBypass(page)` in `tests/utils/auth.ts` inserts a user in the database and signs in through the sign-in form with username and password, so no OAuth provider is needed. `tests/utils/seed-event.ts` seeds event data.

### Expectations

- New behavior includes tests.
- Server actions: test the success path, validation errors and the authorization failure, and check that nothing is written when the call is rejected.
- API routes: test authentication, access checks and validation.

## Database Changes

1. Edit `src/server/db/schema.ts`. Tables are created with `createTable`, which prefixes names with `bingoscape-next_`.
2. Generate the migration with `npm run db:generate`.
3. Review the generated SQL in `drizzle/` and commit it together with the schema change.
4. Apply it locally with `npm run db:migrate`.

Rules:

- Never use `npm run db:push` against production. It runs with `--force` and can delete data. Production uses `db:migrate`.
- Migrations run on every deploy, before the new app version starts. A rollback restores the previous app image but does not revert the database. A migration must therefore stay compatible with the previous app version: add columns and tables first, and remove or rename them in a later release.
- Take a backup before risky data changes (`./scripts/backup-db.sh`). Details are in the Database section of the [README](../README.md#database).
- Wrap mutations in `db.transaction()`. Financial operations (buy-ins, donations) always use transactions.

## Documentation

Update documentation in the same pull request as the code change.

| Change                              | Update                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| New feature or setup change         | [README.md](../README.md)                                                                          |
| RuneLite or web API change          | [docs/API.md](API.md) and `src/app/api/runelite/docs/route.ts`                                     |
| New or changed environment variable | `src/env.js` (if validated), `.env.example`, README Configuration                                  |
| User-visible change                 | `[Unreleased]` in [CHANGELOG.md](../CHANGELOG.md), Keep a Changelog format (Added, Changed, Fixed) |
| New domain term                     | [CONTEXT.md](../CONTEXT.md)                                                                        |
| Deployment, CI or secrets change    | [docs/GITHUB-ACTIONS.md](GITHUB-ACTIONS.md) and [docs/GITHUB-SECRETS.md](GITHUB-SECRETS.md)        |

## Getting Help

- Questions: [GitHub Discussions](https://github.com/bingoscape/bingoscape/discussions)
- Bugs and feature requests: [GitHub Issues](https://github.com/bingoscape/bingoscape/issues)
- Chat: [Discord](https://discord.gg/bingoscape)
- Issues labeled `good first issue` and `help wanted` are good starting points.

Be respectful and constructive in issues, reviews and discussions.

# BingoScape Next

Web application for running Old School RuneScape clan bingo events: boards, teams, submissions with screenshot evidence, clan management, and an API for the RuneLite plugin. Latest released version in the changelog: 1.1.0.

Production instance: [https://bingoscape.org](https://bingoscape.org)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Testing](#testing)
- [RuneLite API](#runelite-api)
- [Database](#database)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Documentation](#documentation)
- [License](#license)
- [Support](#support)

## Features

Boards

- Three board types: standard, progression and battleship (`bingo_type` enum in `src/server/db/schema.ts`).
- Boards have configurable row and column counts.
- Progression boards group tiles into tiers. A tier unlocks when a team earns enough XP. Tier 0 is always unlocked.
- Battleship boards: teams place ships on the board, hits, misses and sunk ships are marked, and an event with a battleship board allows at most two teams. Before the event starts, non-managers see tiles as blind (position only, no content). After the start, players can show their own team's ships with a "My ships" toggle, and managers can open a read-only fleet page.
- Goals per tile: generic, item and metric goals, combined with AND, OR or SUM groups.
- Row, column and diagonal (main and anti-diagonal) bonus XP.
- Templates: save, browse and import boards (`/templates`, `/templates/my-templates`).
- Board export and import as JSON, export format version 2.0 (`CURRENT_EXPORT_VERSION` in `src/lib/bingo-template-schema.ts`).

Events and teams

- Events with rules, registration requests, invite codes, public event pages (`/public/events/[id]`), buy-ins, donations and prize pool.
- Teams, team members and an automatic balanced team generator that uses player skill levels (beginner, intermediate, advanced, expert, pvmgod).
- Event roles: admin, management, participant.
- Scheduled unlock of events and boards through `GET /api/cron/unlock`.

Submissions

- Manual submissions with image upload, review (pending, approved, needs review) and comments.
- Automatic submissions from the RuneLite plugin.
- In-app notifications and Discord webhook notifications.

Clans

- Clan roles: admin, management, member, guest.
- Clan invites and assigning events to clans.

Statistics and integrations

- Event, team and item statistics (Chart.js and Recharts).
- Wise Old Man lookups for player data and competitions.
- Item resolution and Grand Exchange prices from the OSRS Wiki.

Administration

- Super-admin area (`/super-admin`) with users, clans, events and an audit log. Access is controlled by `SUPER_ADMIN_EMAILS`.

## Tech Stack

| Area            | Technology                                                                |
| --------------- | ------------------------------------------------------------------------- |
| Framework       | Next.js 16.4.0 (App Router, standalone output), React 19.3.0              |
| Language        | TypeScript 7 (strict, `noUncheckedIndexedAccess`)                         |
| Database        | PostgreSQL 18, Drizzle ORM 0.33, drizzle-kit 0.24, postgres.js            |
| Authentication  | NextAuth.js 4: credentials, Discord, GitHub (optional), Google (optional) |
| Validation      | Zod 3, `@t3-oss/env-nextjs` for environment variables                     |
| UI              | Tailwind CSS 4, shadcn/ui on Radix UI, Framer Motion, Chart.js, Recharts  |
| Images          | sharp                                                                     |
| Unit tests      | Jest 29, React Testing Library, Testcontainers (PostgreSQL)               |
| End-to-end      | Playwright                                                                |
| Lint and format | ESLint 9, Prettier 3 with the Tailwind plugin                             |
| Runtime         | Node.js 24 (Docker image `node:24-alpine`)                                |

## Architecture

```
src/
  app/              App Router pages and route handlers
    actions/        Server actions ("use server"), tests in __tests__
    api/            auth, cron/unlock, events/invite, runelite, submissions,
                    super-admin, uploads, uptime
    clans/ events/ profile/ public/ sign-in/ sign-up/ super-admin/ templates/
  components/       Business components; ui/ holds shadcn/ui primitives
  hooks/ lib/ types/ styles/ fonts/ __mocks__/
  server/           auth.ts, authz.ts, db/ (index.ts, schema.ts), battleship.ts,
                    blind-board*.ts, progression.ts, tier-progression.ts,
                    notifications.ts, queries/, super-admin/
  env.js            Environment variable schema
  proxy.ts          Redirects unauthenticated users to /sign-in for /events,
                    /clans, /profile, /super-admin and /templates
drizzle/            SQL migrations
scripts/            Backup, restore, deploy and cron scripts
tests/              Playwright specs
docs/               Guides, API reference, design notes
```

- Data is read in Server Components with Drizzle queries and passed to Client Components as props.
- Mutations are server actions in `src/app/actions/` and run inside database transactions.
- Permission checks live in `src/server/authz.ts` and in the server actions.
- RuneLite requests are authenticated with API keys (see RuneLite API).
- Uploaded images are stored in `public/uploads/` and served through `/api/uploads/[...path]`. Submitted screenshot files are named with a `nanoid()`.
- `/api/uptime` is the health check endpoint used by Docker and the deploy script.
- Domain terms (Event, Team, Board, Tile, Blind Tile, Submission, Goal, Tier) are defined in [CONTEXT.md](CONTEXT.md). The database calls a board `bingos`.

## Getting Started

Prerequisites

- Node.js 24 and npm
- PostgreSQL 18 (local install, Docker, or `./start-database.sh`)
- Docker (also required to run `npm test`)
- A Discord application for OAuth. `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are required by the environment schema.

Setup

1. Clone the repository.

   ```bash
   git clone https://github.com/bingoscape/bingoscape.git
   cd bingoscape
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. Create the environment file. The npm scripts load `.env` through `env-cmd`.

   ```bash
   cp .env.example .env
   ```

   Set at least `DATABASE_URL`, `NEXTAUTH_URL`, `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`. For the Discord application, set the redirect URL to `{NEXTAUTH_URL}/api/auth/callback/discord`. Add your own address to `SUPER_ADMIN_EMAILS` to get super-admin access. All variables are listed under Configuration.

4. Start a database. Use one of the following.

   ```bash
   # Option A: standalone container named bingoscape-next-postgres, database "bingoscape".
   # Reads DATABASE_URL from .env and offers to replace the default password.
   ./start-database.sh

   # Option B: only the postgres service from docker-compose.yml
   # (user postgres, password postgres, database bingoscape, port 127.0.0.1:5432).
   # Set DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bingoscape"
   docker compose up -d postgres
   ```

   `start-database.sh` runs under bash. On Windows use WSL.

5. Apply the migrations. A fresh database only needs `db:migrate`. Run `db:generate` only after changing `src/server/db/schema.ts`.

   ```bash
   npm run db:migrate
   ```

6. Start the development server and open http://localhost:3000.

   ```bash
   npm run dev
   ```

Do not use `docker compose up -d` without a service name for development. It also starts the `app` service, which pulls the published image and binds port 3000.

## Configuration

Variables are validated in `src/env.js`. Some are read directly from `process.env`.

| Variable                                     | Required             | Description                                                                                                                                                            |
| -------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | yes                  | PostgreSQL connection URL. Example: `postgresql://postgres:password@localhost:5432/bingoscape`.                                                                        |
| `NEXTAUTH_URL`                               | yes                  | Public URL of the app. `VERCEL_URL` takes precedence when set.                                                                                                         |
| `NEXTAUTH_SECRET`                            | in production        | Session secret. Generate with `openssl rand -base64 32`.                                                                                                               |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | yes                  | Discord OAuth application.                                                                                                                                             |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`   | no                   | Enables GitHub sign-in. Callback `{NEXTAUTH_URL}/api/auth/callback/github`. In GitHub Actions the secrets are named `GH_OAUTH_CLIENT_ID` and `GH_OAUTH_CLIENT_SECRET`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`   | no                   | Enables Google sign-in. Callback `{NEXTAUTH_URL}/api/auth/callback/google`.                                                                                            |
| `SUPER_ADMIN_EMAILS`                         | no                   | Comma-separated super-admin emails, compared case-insensitively with the email stored in the database. If empty, nobody is a super admin.                              |
| `CRON_SECRET`                                | for scheduled unlock | Bearer token for `GET /api/cron/unlock`. The route answers 401 when it is unset. `scripts/setup-unlock-cron.sh` sets up a cron job that calls it every minute.         |
| `OSRS_WIKI_CONTACT_EMAIL`                    | recommended          | Contact address in the User-Agent of OSRS Wiki price requests. Defaults to `unknown@example.com`.                                                                      |
| `WISEOLDMAN_API_KEY`                         | no                   | Wise Old Man API key for higher rate limits.                                                                                                                           |
| `NEXT_PUBLIC_BASE_URL`                       | no                   | Base URL used for public event page metadata. Defaults to `https://bingoscape.org`.                                                                                    |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`         | production (Docker)  | Passed through by `docker-compose.yml`.                                                                                                                                |
| `SKIP_ENV_VALIDATION`                        | no                   | Set to `1` to skip validation (Docker build, CI).                                                                                                                      |
| `NODE_ENV`                                   | no                   | `development`, `test` or `production`.                                                                                                                                 |

`docker-compose.yml` also reads `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME`, `DB_PORT` and `IMAGE_TAG` (defaults: `postgres`, `postgres`, `bingoscapedb`, `bingoscape`, `5432`, `main`).

## Scripts

| Command                         | Description                                                               |
| ------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                   | Development server on port 3000.                                          |
| `npm run dbg`                   | Development server with the Node.js inspector.                            |
| `npm run build`                 | Production build (loads `.env`).                                          |
| `npm run build:ci`              | Production build without `env-cmd` (used in the Dockerfile).              |
| `npm start`                     | Production server on port 3344.                                           |
| `npm run start:prod`            | Production server on port 3333.                                           |
| `npm run lint`                  | ESLint. Add `-- --fix` to fix automatically.                              |
| `npx tsc --noEmit`              | Type check. Also runs in CI.                                              |
| `npm test`                      | Jest unit tests. Docker must be running.                                  |
| `npm run test:watch`            | Jest in watch mode.                                                       |
| `npm run test:e2e`              | Playwright tests. `test:e2e:ui` and `test:e2e:headed` are also available. |
| `npm run db:generate`           | Generate a Drizzle migration from schema changes.                         |
| `npm run db:migrate`            | Apply migrations. Use this in production.                                 |
| `npm run db:push`               | Push the schema with `--force`. Can delete data. Not for production.      |
| `npm run db:studio`             | Open Drizzle Studio.                                                      |
| `npm run db:backfill-templates` | Fill template metadata with `scripts/backfill-template-metadata.ts`.      |

## Testing

- `npm test` runs Jest 29 (jsdom, `next/jest`). Test files match `**/__tests__/**/*.test.[jt]s?(x)` and are co-located with the code under `src/`.
- Jest global setup starts a `postgres:15-alpine` Testcontainers database, so Docker must be running.
- Run one file with `npm test -- <path>`, or filter with `npm test -- --testNamePattern="<pattern>"`.
- `npm run test:e2e` runs the Playwright specs in `tests/` against `http://localhost:3001` with an ephemeral database.
- CI runs lint, `npx tsc --noEmit`, `npm test` and `docker compose config -q`. It does not run the Playwright tests.

## RuneLite API

The RuneLite plugin ([BingoScape Companion on the Plugin Hub](https://runelite.net/plugin-hub/show/bingoscape-companion)) talks to the server with API keys.

- Create a key in the web app. `POST /api/runelite/keys` (session cookie required, body `{ "name": string, "description"?: string }`) returns a key of the form `bsn_<32 characters>`. The full key is returned only on creation.
- `GET /api/runelite/keys` lists a user's keys and `DELETE /api/runelite/keys/{id}` revokes one. A user can hold several keys.
- Plugin requests send `Authorization: Bearer bsn_...`.

| Method | Path                                            | Purpose                                                                                               |
| ------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| POST   | `/api/runelite/auth`                            | Validate a key. Body `{ "apiKey": "bsn_..." }`.                                                       |
| GET    | `/api/runelite/events`                          | Events and boards of the key owner, all board types.                                                  |
| GET    | `/api/runelite/bingos/{bingoId}`                | Board payload. Supports `ETag` and `If-None-Match` (304). Rate limit 60 requests per minute per user. |
| POST   | `/api/runelite/tiles/{tileId}/submissions`      | Submit a screenshot (`multipart/form-data`, field `image`).                                           |
| POST   | `/api/runelite/tiles/{tileId}/auto-submissions` | Automatic submission.                                                                                 |
| POST   | `/api/runelite/items/check`                     | Check items against goals.                                                                            |
| GET    | `/api/runelite/team-drops`                      | Team drops.                                                                                           |
| GET    | `/api/runelite/team-tile-completions`           | Team tile completions.                                                                                |
| GET    | `/api/runelite/docs`                            | Machine-readable API description (version 2.1.0).                                                     |

API version 2.1 is additive. Board payloads carry `apiVersion: "2.1"`, progression tiers and locked-tile stubs, and a `battleship` block with blind-tile redaction. Error codes `TIER_LOCKED`, `BOARD_BLIND` and `EVENT_NOT_STARTED` were added. Full request and response details are in [docs/API.md](docs/API.md).

## Database

- 41 tables defined in `src/server/db/schema.ts`. All table names carry the prefix `bingoscape-next_` (`createTable`, and `tablesFilter` in `drizzle.config.ts`).
- 39 SQL migrations in `drizzle/`.
- Table groups:
  - Auth: `user`, `account`, `session`, `verificationToken`
  - Events: `events`, `event_rules`, `event_registration_requests`, `event_participants`, `event_invites`, `event_buy_ins`, `event_donations`
  - Boards: `bingos`, `tiles`, `goal_groups`, `goals`, `goal_values`, `item_goals`, `metric_goals`, `row_bonuses`, `column_bonuses`, `bingo_templates`
  - Teams and progress: `teams`, `team_members`, `team_tile_submissions`, `team_goal_progress`, `team_tier_progress`, `tier_xp_requirements`
  - Submissions: `submissions`, `submission_comments`, `images`
  - Clans: `clans`, `clan_members`, `clan_invites`
  - Battleship: `bingo_ship_rules`, `battleship_ships`, `battleship_ship_tiles`
  - Other: `player_metadata`, `notifications`, `api_keys`, `discord_webhooks`, `admin_audit_log`
- Schema change workflow: edit `schema.ts`, run `npm run db:generate`, commit the generated SQL, run `npm run db:migrate`.
- Migrations run on every deploy before the new app version starts. A rollback does not revert the database, so a migration must stay compatible with the previous app version: add first, remove in a later release.
- Backups are gzip SQL dumps made by `scripts/backup-db.sh`:

  | Type       | Schedule                | Kept |
  | ---------- | ----------------------- | ---- |
  | daily      | 03:00                   | 7    |
  | weekly     | Sunday 02:00            | 4    |
  | monthly    | 1st of the month, 01:00 | 6    |
  | pre-deploy | before each deploy      | 10   |

  Files are stored under `~/bingoscape/backups/<type>/`. Set up the schedule with `scripts/setup-backup-cron.sh`. Restore with `scripts/restore-db.sh <backup-file>`, which creates a safety backup first and asks for confirmation. `scripts/verify-backup.sh` restores a backup into a temporary container to check it, and runs monthly (first Sunday, 05:00).

## Deployment

Production runs as Docker containers on a Debian host behind nginx and certbot (not part of this repository). The app listens on `127.0.0.1:3000`.

- Images: `ghcr.io/bingoscape/bingoscape` (target `runner`, the app) and `ghcr.io/bingoscape/bingoscape-migrator` (target `migrator`, runs `drizzle-kit migrate`). Both receive the same tags, so one `IMAGE_TAG` selects both.
- CI (`.github/workflows/ci-cd.yml`) runs on pull requests to `main`, pushes to `main` and `v*.*.*` tags: lint, type check, tests, then a Docker build of both targets on Node 24. Pull requests only build. Pushes to `main` publish `:main` and `:sha-<short>`. Release tags publish `:X.Y.Z`, `:X.Y`, `:X` and, for tags without a pre-release suffix, `:latest`.
- Deploys are manual: run the Deploy workflow (`deploy.yml`, `workflow_dispatch`) with `image_tag` set to `main`, `sha-<short>` or a release tag. There is a single `production` environment and no staging.
- `scripts/deploy.sh` runs on the server: pull images, pre-deploy backup (skipped if PostgreSQL is not running yet), run migrations, replace only the app container, wait for a healthy `/api/uptime`, record the tag in `~/bingoscape/.deployed-tag`. A failure after the app was replaced restores the previous image.
- `migrate.yml` runs migrations without a deploy. It is manual and requires typing `MIGRATE`.
- Uploads are stored on the host in `./uploads`, mounted at `/app/public/uploads`.
- Dependabot opens weekly PRs for GitHub Actions, Docker base images (Node stays on major 24) and npm.

Setup guides: [docs/PRODUCTION-SETUP.md](docs/PRODUCTION-SETUP.md), [docs/GITHUB-ACTIONS.md](docs/GITHUB-ACTIONS.md), [docs/GITHUB-SECRETS.md](docs/GITHUB-SECRETS.md), [docs/DEBIAN-USER-SETUP.md](docs/DEBIAN-USER-SETUP.md), [docs/DATABASE-MIGRATION.md](docs/DATABASE-MIGRATION.md).

## Contributing

1. Fork the repository and create a branch such as `feat/<topic>` or `fix/<topic>`.
2. Make the change. Add or update tests.
3. Run `npm run lint -- --fix`, `npx tsc --noEmit` and `npm test`.
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/), for example `feat(battleship): add ship placement page` or `fix(tiers): unlock the next tier after board edits`.
5. Open a pull request against `main`.

Code rules (details in [AGENTS.md](AGENTS.md) and [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)):

- Do not bypass ESLint or the type checker (`eslint-disable`, `@ts-ignore`) without a justification comment.
- Wrap mutations in `db.transaction()` and revalidate affected paths.
- Check permissions in server actions before mutating.
- Import internal modules through the `@/` alias.

## Documentation

| File                                                     | Content                                 |
| -------------------------------------------------------- | --------------------------------------- |
| [docs/API.md](docs/API.md)                               | RuneLite and web API reference          |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)             | Contribution guide                      |
| [docs/PRODUCTION-SETUP.md](docs/PRODUCTION-SETUP.md)     | Production server setup                 |
| [docs/GITHUB-ACTIONS.md](docs/GITHUB-ACTIONS.md)         | CI, deploy and migration workflows      |
| [docs/GITHUB-SECRETS.md](docs/GITHUB-SECRETS.md)         | GitHub secrets used by the workflows    |
| [docs/DEBIAN-USER-SETUP.md](docs/DEBIAN-USER-SETUP.md)   | Deployment user on the server           |
| [docs/DATABASE-MIGRATION.md](docs/DATABASE-MIGRATION.md) | Moving from the old non-Docker database |
| [docs/design/osrs-theme.md](docs/design/osrs-theme.md)   | Interface theme                         |
| [CHANGELOG.md](CHANGELOG.md)                             | Release notes                           |
| [CONTEXT.md](CONTEXT.md)                                 | Domain vocabulary                       |
| [AGENTS.md](AGENTS.md)                                   | Commands and code conventions           |

## License

BSD 2-Clause License. See [LICENSE](LICENSE).

## Support

- Issues: https://github.com/bingoscape/bingoscape/issues
- Discussions: https://github.com/bingoscape/bingoscape/discussions
- Discord: https://discord.gg/bingoscape

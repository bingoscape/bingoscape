# AGENTS.md - Bingoscape Next

## Development Commands

### Build & Quality

- `npm run build` - Build Next.js application for production
- `npm run lint` - Run ESLint (auto-fix with `npm run lint -- --fix`)
- `npm run dev` - Start development server (port 3000)
- `npm run dbg` - Start dev server with Node.js inspector for debugging
- `npm start` - Start production server on port 3344
- `npm run start:prod` - Start production server on port 3333

**env-cmd:** Every dev/build script is wrapped with `env-cmd`, which loads `.env` at runtime. **Never run `next dev` or `next build` directly** — env vars will not be loaded and startup will fail.

**CI / Docker builds:** Use `npm run build:ci` (no `env-cmd`) and set `SKIP_ENV_VALIDATION=true` to bypass T3 env validation. The `build:ci` script is what GitHub Actions uses.

### Testing

Testing infrastructure has been removed and is pending a full rewrite. No test scripts or test dependencies currently exist in the project.

### Database

- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:push` - Push schema to database (force) - **⚠️ USE WITH CAUTION: Deletes data**
- `npm run db:migrate` - Run database migrations - **✅ PREFERRED for production**
- `npm run db:studio` - Open Drizzle Studio

**Two Drizzle configs:** `drizzle.config.ts` uses the TS `@/env` alias (works with `env-cmd` npm scripts locally). `drizzle.config.prod.js` uses raw `process.env` (no TS paths — used in Docker/CI). The `db:*` npm scripts use the TS config.

**⚠️ Duplicate migration:** `drizzle/0019_enhance_clan_invites.sql` and `drizzle/0019_overconfident_stranger.sql` both exist — potential migration history conflict. Do not generate a new `0019_*` file; investigate before running `db:generate` if near that sequence.

### Database Backups & Recovery

**Backup Commands:**

- `./scripts/backup-db.sh daily` - Create daily backup manually
- `./scripts/backup-db.sh weekly` - Create weekly backup manually
- `./scripts/backup-db.sh monthly` - Create monthly backup manually
- `./scripts/backup-db.sh pre-deploy <git-sha>` - Create pre-deployment backup
- `./scripts/setup-backup-cron.sh` - Setup automated backups (run once on server)

**Restore Commands:**

- `./scripts/restore-db.sh <backup-file>` - Restore database from backup
  - Example: `./scripts/restore-db.sh backups/daily/daily-2026-03-12.sql.gz`
  - Creates safety backup automatically before restore
  - Interactive confirmation required

**Verification:**

- `./scripts/verify-backup.sh [backup-file]` - Verify backup is restorable
  - Runs monthly via cron automatically
  - Restores backup to temporary container and validates data

**Backup Schedule (Automated via Cron):**

- Daily: 3:00 AM (keep last 7)
- Weekly: 2:00 AM Sunday (keep last 4)
- Monthly: 1:00 AM on 1st (keep last 6)
- Pre-deploy: Before each deployment (keep last 10)
- Verification: 5:00 AM first Sunday of month

**Backup Locations:**

- Daily: `~/bingoscape/backups/daily/`
- Weekly: `~/bingoscape/backups/weekly/`
- Monthly: `~/bingoscape/backups/monthly/`
- Pre-deploy: `~/bingoscape/backups/pre-deploy/`
- Pre-restore: `~/bingoscape/backups/pre-restore/` (safety backups)

**Logs:**

- Backup logs: `~/bingoscape/backups/backup.log`
- Verification logs: `~/bingoscape/backups/verification.log`

**Important Notes:**

- ⚠️ **ALWAYS use `db:migrate` for production** - Never use `db:push` which has `--force` flag
- ✅ Pre-deployment backups are **automatic** via GitHub Actions
- ✅ All backups are compressed SQL dumps (`.sql.gz` format)
- ✅ Backups are validated automatically (file size and gzip integrity)
- ✅ Restore creates safety backup before overwriting data
- 📊 Monitor logs regularly to ensure backups complete successfully

## Code Style Guidelines

### Imports

- Use `"use server"` directive for server actions, `"use client"` for client components
- Type-only imports: `import type { Foo } from "./bar"`
- Import order: external libraries, internal `@/*` imports, type imports
- Use `@/` alias for all internal imports (configured in tsconfig.json)

### Formatting

- Prettier with tailwindcss plugin auto-formats on save
- Tailwind classes are auto-sorted by the plugin
- **No semicolons** (`semi: false`), **double quotes** (`singleQuote: false`), trailing commas ES5-style

### TypeScript

- Strict mode enabled with `noUncheckedIndexedAccess`
- Use Drizzle type inference: `typeof table.$inferInsert` / `typeof table.$inferSelect`
- Monetary values in database: use `bigint` type for precision
- Non-null assertions allowed only where necessary (add eslint-disable comment)

### Naming Conventions

- Components: PascalCase (`EventCard`, `BingoGrid`)
- Functions/variables: camelCase (`updateTile`, `handleTileClick`)
- Files: kebab-case (`event-card.tsx`, `bingo-grid.tsx`)
- Server actions: camelCase with async (`createBingo`, `updateTile`)

### Error Handling

- Server actions: Return `{ success: boolean, error?: string }` objects
- Client components: Wrap async calls in try-catch, display toast with `variant: "destructive"`
- Database operations: Always include try-catch blocks with error logging
- Validation: Return early with error objects for invalid inputs
- Use `toast()` from `@/hooks/use-toast` for user notifications

### Database & State Management

- All mutations wrapped in database transactions (use `db.transaction()`)
- Revalidate paths after mutations: `revalidatePath("/")`
- Use `useState` for local component state, `useEffect` for side effects
- Memoize with `useCallback` for event handlers and dependencies
- Financial operations (buy-ins, donations): Always use transactions
- Optimistic UI updates preferred for better UX

### Server Actions

- Export functions from `src/app/actions/` with `"use server"` directive
- Return typed success/error objects, never throw (unless critical)
- Validate inputs at the beginning of functions
- Use `getServerAuthSession()` for authentication
- Check permissions with `getUserRole()` before mutations

### Component Patterns

- Use shadcn/ui components from `@/components/ui/` for UI elements
- Business logic components in `src/components/` without `ui/` subfolder
- Props interface: `interface ComponentNameProps { ... }`
- Use `cn()` utility from `@/lib/utils` for conditional className merging
- Use forwardRef for components that need ref forwarding

### Testing

Testing infrastructure has been removed and is pending a full rewrite. No test scripts or test dependencies currently exist in the project.

### Additional Notes

- React 19.2.3 with Next.js 16.1.1 App Router (README incorrectly says 14/18 — trust package.json)
- PostgreSQL database with Drizzle ORM
- NextAuth for authentication (Discord OAuth + Credentials)
- Use `nanoid()` for ID generation
- Images stored in `public/uploads/` with absolute paths in DB — served via API rewrite `/uploads/:path` → `/api/uploads/:path` (not served statically)
- Console removed in production builds
- Sentry integration for error tracking
- `SUPER_ADMIN_EMAILS` env var controls superadmin access but is **not** in the T3 env schema — missing it won't fail validation
- No pre-commit hooks (no Husky/Lefthook) — CI is the only quality gate
- CI (`ci-cd.yml`) only runs `lint`; type-check is commented out in the workflow
- Observability: structured logging via `pino`, metrics via `prom-client`; initialized in `src/instrumentation.ts`; full Grafana/Prometheus/Loki stack in `observability/`
- Deployment target is Docker (`output: "standalone"` in `next.config.mjs`), not Vercel

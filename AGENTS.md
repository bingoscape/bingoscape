# AGENTS.md - Bingoscape Next

## Development Commands

### Build & Quality

- `npm run build` - Build Next.js application for production
- `npm run lint` - Run ESLint (auto-fix with `npm run lint -- --fix`)
- `npm run dev` - Start development server (port 3000)
- `npm run dbg` - Start dev server with Node.js inspector for debugging
- `npm start` - Start production server on port 3344
- `npm run start:prod` - Start production server on port 3333

### Testing

- `npm test` - Run all Jest unit tests
- `npm run test:watch` - Run Jest in watch mode
- `npm test -- <path-to-test>` - Run a specific test file
- `npm test -- --testNamePattern="<pattern>"` - Run tests matching a pattern
- `npm run test:e2e` - Run Playwright end-to-end tests
- `npm run test:e2e:ui` - Run Playwright with UI
- `npm run test:e2e:headed` - Run Playwright in headed mode

### Database

- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:push` - Push schema to database (force) - **⚠️ USE WITH CAUTION: Deletes data**
- `npm run db:migrate` - Run database migrations - **✅ PREFERRED for production**
- `npm run db:studio` - Open Drizzle Studio

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

### Formatting & Linter

- Prettier with tailwindcss plugin auto-formats on save
- Tailwind classes are auto-sorted by the plugin
- Agents must run `npm run lint -- --fix` after making changes
- **NEVER** bypass ESLint errors (e.g., no `// eslint-disable` or `@ts-ignore`) unless it is a known false positive, which requires a justification comment next to the suppression

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
- Test files: `<name>.test.tsx` in `__tests__` directories or co-located

### Error Handling

- Server actions: Return `{ success: boolean, error?: string }` objects
- Client components: Wrap async calls in try-catch, display toast with `variant: "destructive"`
- Database operations: Always include try-catch blocks with error logging
- Validation: Return early with error objects for invalid inputs
- Use `toast()` from `@/hooks/use-toast` for user notifications

### Data Fetching

- All data fetching must occur in Server Components via direct Drizzle queries
- Pass fetched data as props to Client Components
- Client-side data fetching (e.g., `useEffect` fetches) is strictly prohibited unless continuous polling or real-time updating is required

### Database

- All mutations wrapped in database transactions (use `db.transaction()`)
- Revalidate paths after mutations: `revalidatePath("/")`
- Financial operations (buy-ins, donations): Always use transactions

### Client State Management

- Keep client state to an absolute minimum
- Use standard React hooks (`useState`, `useReducer`) for transient UI state
- Use URL search parameters for any state that needs to be shared or bookmarked
- **Global state managers (Redux, Zustand, etc.) are explicitly forbidden**
- Use `useEffect` sparingly for side effects; memoize with `useCallback` for event handlers/dependencies
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

- Unit tests: Jest + React Testing Library
- E2E tests: Playwright in `tests/` directory
- Test file pattern: `**/__tests__/**/*.test.[jt]s?(x)`
- Mock dependencies with `jest.mock()`
- Use `screen.getBy*` for selecting elements (avoid `screen.queryBy*` for positive assertions)
- Describe blocks for component/context, `it` for specific test cases
- Mock current date for consistent testing

### Additional Notes

- React 19.2.3 with Next.js 16.1.1 App Router
- PostgreSQL database with Drizzle ORM
- NextAuth for authentication (Discord OAuth + Credentials)
- Use `nanoid()` for ID generation
- Images stored in `public/uploads/` with absolute paths in DB
- Console removed in production builds
- Sentry integration for error tracking

## Agent skills

### Issue tracker

GitHub issues (using the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.

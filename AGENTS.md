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
- `npm run db:push` - Push schema to database (force)
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio

## Code Style Guidelines

### Imports

- Use `"use server"` directive for server actions, `"use client"` for client components
- Type-only imports: `import type { Foo } from "./bar"`
- Import order: external libraries, internal `@/*` imports, type imports
- Use `@/` alias for all internal imports (configured in tsconfig.json)

### Formatting

- Prettier with tailwindcss plugin auto-formats on save
- Tailwind classes are auto-sorted by the plugin

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

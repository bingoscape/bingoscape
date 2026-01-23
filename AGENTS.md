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

## Distributed Tracing

### Overview

The application uses **OpenTelemetry** for distributed tracing with **Grafana Tempo** as the backend. All HTTP requests, database queries, file operations, and custom code paths are automatically traced.

### Automatic Instrumentation

The following operations are **automatically traced** (zero code changes required):

- HTTP requests (incoming and outgoing)
- Database queries (PostgreSQL via pg driver)
- File system operations
- DNS lookups
- Network connections
- Next.js App Router pages
- Next.js API routes
- Next.js Server Actions

### Custom Tracing

For manual instrumentation, use the helpers from `@/lib/tracing`:

#### Trace Server Actions

```typescript
"use server"

import { traceServerAction } from "@/lib/tracing"

export async function createEvent(data: EventInput) {
  return traceServerAction("createEvent", async (span) => {
    // Add custom attributes to the span
    span.setAttributes({
      "event.name": data.name,
      "event.type": data.type,
      "user.id": session.user.id,
    })

    const result = await db.insert(events).values(data)

    // Add result metadata
    span.setAttribute("event.id", result[0].id)

    return result
  })
}
```

#### Trace External API Calls

```typescript
import { traceExternalAPI } from "@/lib/tracing"

const playerData = await traceExternalAPI(
  "fetch_osrs_player",
  "https://api.wiseoldman.net/v2/players/username/player1",
  async (span) => {
    const response = await fetch(url)

    // Add response metadata
    span.setAttributes({
      "http.status_code": response.status,
      "http.response_content_length": response.headers.get("content-length"),
    })

    const data = await response.json()

    // Add business metrics
    span.setAttribute(
      "player.total_level",
      data.latestSnapshot.data.skills.overall.level
    )

    return data
  }
)
```

#### Trace Database Operations

```typescript
import { traceDbOperation } from "@/lib/tracing"

const result = await traceDbOperation(
  "create_event_with_tiles",
  "transaction",
  async (span) => {
    return db.transaction(async (tx) => {
      const [event] = await tx.insert(events).values(eventData)
      const tiles = await tx.insert(tilesTable).values(tileData)

      // Add metrics to span
      span.setAttributes({
        "event.id": event.id,
        "tiles.count": tiles.length,
      })

      return { event, tiles }
    })
  }
)
```

#### Trace File Operations

```typescript
import { traceFileOperation } from "@/lib/tracing"

const uploadedPath = await traceFileOperation(
  "upload_event_image",
  async (span) => {
    const buffer = await file.arrayBuffer()
    const path = await saveImage(buffer, "events")

    span.setAttributes({
      "file.size": buffer.byteLength,
      "file.path": path,
      "file.mime_type": file.type,
    })

    return path
  }
)
```

#### Add Attributes to Current Span

```typescript
import { addSpanAttributes } from "@/lib/tracing"

// Add context to any auto-instrumented span
addSpanAttributes({
  "user.id": session.user.id,
  "user.role": session.user.role,
  "event.id": eventId,
})
```

### Trace-to-Logs Correlation

Link traces with logs by including trace context:

```typescript
import { logger } from "@/lib/logger"
import { getTraceContext } from "@/lib/tracing"

logger.info(
  {
    ...getTraceContext(), // Adds traceId and spanId
    userId: session.user.id,
    eventId: event.id,
  },
  "Event created successfully"
)
```

In Grafana:

- Clicking a trace will show related logs
- Clicking a log entry will jump to the full trace

### Viewing Traces in Grafana

1. Open Grafana: http://localhost:3001
2. Go to **Explore** → Select **Tempo** datasource
3. Use TraceQL queries to find traces:

```traceql
# All slow requests
{duration > 500ms}

# Failed requests
{status.code = error}

# Database operations
{span.db.system="postgresql"}

# Server actions
{span.name =~ "server_action.*"}

# External API calls
{span.name =~ "external_api.*"}
```

4. Click on any trace to see:
   - Waterfall view of all spans
   - Service graph showing dependencies
   - Related logs (click "Logs for this span")
   - Related metrics (click "Metrics for this span")

### Sampling Configuration

**Development**:

- 100% sampling (all requests traced)
- Set via `OTEL_TRACES_SAMPLER=always_on`

**Production**:

- 10% parent-based sampling (configurable)
- Set via `OTEL_TRACES_SAMPLER=parentbased_traceidratio`
- Set via `OTEL_TRACES_SAMPLER_ARG=0.1`

To adjust production sampling rate, change `OTEL_TRACES_SAMPLER_ARG`:

- `0.1` = 10% sampling
- `0.2` = 20% sampling
- `1.0` = 100% sampling

**Parent-based sampling** ensures that if a trace is sampled, all child spans are included for complete request visibility.

### Service Graph

Tempo generates a service dependency graph showing:

- Next.js application
- PostgreSQL database
- External APIs (WiseOldMan, Discord)
- File storage operations

Access via: **Grafana → Explore → Tempo → Service Graph** tab

### Performance Considerations

- Auto-instrumentation adds **minimal overhead** (~1-2ms per request)
- 10% sampling in production reduces storage and processing costs
- Traces are retained for **30 days** (same as metrics and logs)
- Service graph and span metrics are pre-aggregated for fast queries

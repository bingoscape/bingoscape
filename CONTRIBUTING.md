# Contributing to BingoScape Next

We welcome contributions to BingoScape Next! This guide will help you get started with contributing to our OSRS bingo management platform.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Contribution Process](#contribution-process)
- [Testing Guidelines](#testing-guidelines)
- [Database Changes](#database-changes)
- [Documentation](#documentation)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 18+** (LTS recommended)
- **PostgreSQL 14+** (or Docker for local development)
- **Git** (latest version)
- **GitHub account** with SSH keys configured

### Areas for Contribution

We welcome contributions in these areas:

- 🐛 **Bug Fixes** - Resolve issues and improve stability
- ✨ **New Features** - Enhance the bingo management system
- 🎨 **UI/UX Improvements** - Enhance user experience and accessibility
- 📚 **Documentation** - Improve guides, API docs, and code comments
- 🧪 **Testing** - Add unit tests and E2E test coverage
- 🔧 **Performance** - Optimize queries, reduce bundle size, improve loading
- 🌐 **RuneLite Plugin** - Enhance game client integration
- 🛡️ **Security** - Identify and fix security vulnerabilities

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone git@github.com:YOUR_USERNAME/bingoscape-next.git
cd bingoscape-next

# Add upstream remote
git remote add upstream git@github.com:bingoscape/bingoscape-next.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your configuration
# Minimum required: DATABASE_URL, NEXTAUTH_SECRET, Discord OAuth
```

### 4. Database Setup

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL locally, then:
createdb bingoscape-next
npm run db:migrate
```

**Option B: Docker**
```bash
# Start PostgreSQL with Docker
docker-compose up -d
npm run db:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

### 6. Verify Setup

```bash
# Run tests to ensure everything works
npm run test
npm run lint
```

## Code Standards

### TypeScript Guidelines

- **Strict Mode**: All code must pass TypeScript strict checks
- **No `any` Types**: Use proper typing or `unknown` with type guards
- **Type Exports**: Export types alongside implementations
- **Interface Naming**: Use descriptive names (e.g., `EventData`, `BingoTile`)

```typescript
// ✅ Good
interface CreateEventData {
  title: string
  startDate: Date
  endDate: Date
}

export async function createEvent(data: CreateEventData): Promise<ActionResult<Event>> {
  // Implementation
}

// ❌ Bad  
export async function createEvent(data: any) {
  // Implementation
}
```

### Code Formatting

We use **ESLint** and **Prettier** for consistent code formatting:

```bash
# Format code
npm run lint:fix

# Check formatting
npm run lint
```

**Key Rules:**
- 2-space indentation
- Semicolons required
- Single quotes for strings
- Trailing commas in objects/arrays
- No unused variables or imports

### Component Guidelines

**React Components:**
```typescript
// ✅ Good - Proper typing and component structure
interface BingoTileProps {
  tile: TileData
  onSubmit: (tileId: string) => Promise<void>
  isDisabled?: boolean
}

export function BingoTile({ tile, onSubmit, isDisabled = false }: BingoTileProps) {
  return (
    <div className="relative rounded-lg border-2 border-border">
      {/* Component implementation */}
    </div>
  )
}
```

**Server Actions:**
```typescript
// ✅ Good - Proper error handling and typing
export async function createBingo(formData: FormData): Promise<ActionResult<Bingo>> {
  try {
    const validatedData = createBingoSchema.parse({
      title: formData.get("title"),
      eventId: formData.get("eventId")
    })

    const [bingo] = await db.insert(bingos).values(validatedData).returning()
    
    revalidatePath(`/events/${validatedData.eventId}`)
    return { success: true, data: bingo }
  } catch (error) {
    console.error("Error creating bingo:", error)
    
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input data" }
    }
    
    return { success: false, error: "Failed to create bingo" }
  }
}
```

### Database Guidelines

**Schema Changes:**
- Use Drizzle ORM for all database operations
- Create migrations for schema changes
- Include relations for complex queries
- Use proper indexing for performance

**Query Patterns:**
```typescript
// ✅ Good - Use relations for complex queries
const bingo = await db.query.bingos.findFirst({
  where: eq(bingos.id, bingoId),
  with: {
    tiles: {
      with: {
        goals: true,
        teamTileSubmissions: {
          where: eq(teamTileSubmissions.teamId, teamId)
        }
      }
    }
  }
})

// ❌ Bad - Multiple separate queries
const bingo = await db.select().from(bingos).where(eq(bingos.id, bingoId))
const tiles = await db.select().from(tiles).where(eq(tiles.bingoId, bingoId))
```

## Contribution Process

### 1. Planning

**For Bug Fixes:**
- Check existing issues to avoid duplicates
- Create issue if one doesn't exist
- Discuss approach in issue comments

**For New Features:**
- Open issue or discussion first
- Wait for maintainer approval before starting
- Consider breaking changes and backwards compatibility

### 2. Development Workflow

```bash
# 1. Update your fork
git checkout main
git pull upstream main
git push origin main

# 2. Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description

# 3. Make your changes
# ... code, test, commit ...

# 4. Keep branch updated
git fetch upstream
git rebase upstream/main

# 5. Push changes
git push origin feature/your-feature-name
```

### 3. Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```bash
# Format: type(scope): description

feat(bingo): add progression tier unlocking system
fix(api): resolve race condition in submission uploads
docs(readme): add RuneLite plugin setup instructions
test(events): add integration tests for event creation
style(ui): improve button hover states and animations
refactor(db): optimize bingo query performance
chore(deps): update Next.js to version 14.2.4
```

**Types:** `feat`, `fix`, `docs`, `test`, `style`, `refactor`, `chore`

### 4. Pull Request Process

**Before Submitting:**
```bash
# Run full test suite
npm run test
npm run test:e2e

# Check code quality
npm run lint
npm run type-check

# Build successfully
npm run build
```

**PR Requirements:**
- Descriptive title and description
- Reference related issues (e.g., "Fixes #123")
- Include screenshots for UI changes
- Add tests for new functionality
- Update documentation if needed

**PR Template:**
```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix/feature that causes existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass (`npm run test`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes.

## Related Issues
Fixes #(issue number)
```

### 5. Review Process

- All PRs require at least one review from maintainers
- Address review feedback promptly
- Keep discussions focused and constructive
- Be patient - reviews may take a few days

## Testing Guidelines

### Unit Tests (Jest)

**Location:** `src/**/__tests__/` or `*.test.ts` files

```typescript
// Example component test
import { render, screen } from '@testing-library/react'
import { BingoTile } from '../bingo-tile'

describe('BingoTile', () => {
  it('renders tile title correctly', () => {
    const mockTile = {
      id: '1',
      title: 'Kill Zulrah',
      description: 'Defeat Zulrah once'
    }

    render(<BingoTile tile={mockTile} />)
    
    expect(screen.getByText('Kill Zulrah')).toBeInTheDocument()
  })
})
```

**Server Action Tests:**
```typescript
// Example server action test
import { createBingo } from '../bingo'

describe('createBingo', () => {
  it('creates bingo with valid data', async () => {
    const formData = new FormData()
    formData.append('title', 'Test Bingo')
    formData.append('eventId', 'event-1')

    const result = await createBingo(formData)
    
    expect(result.success).toBe(true)
    expect(result.data.title).toBe('Test Bingo')
  })
})
```

### E2E Tests (Playwright)

**Location:** `tests/` directory

```typescript
// Example E2E test
import { test, expect } from '@playwright/test'

test('user can create new bingo event', async ({ page }) => {
  await page.goto('/events')
  
  await page.click('text=Create Event')
  await page.fill('[name="title"]', 'Test Event')
  await page.fill('[name="description"]', 'Test Description')
  await page.click('button[type="submit"]')
  
  await expect(page.locator('text=Test Event')).toBeVisible()
})
```

### Test Requirements

- **New Features**: Must include unit tests
- **Bug Fixes**: Must include regression tests
- **Server Actions**: Must test both success and error cases
- **Components**: Must test key functionality and edge cases
- **API Endpoints**: Must test authentication and validation

## Database Changes

### Schema Migrations

When modifying the database schema:

```bash
# 1. Update schema.ts
# Edit src/server/db/schema.ts

# 2. Generate migration
npm run db:generate

# 3. Review generated SQL
# Check drizzle/ directory for new migration files

# 4. Test migration
npm run db:migrate

# 5. Update seed data if needed
# Edit any seed scripts or test fixtures
```

### Migration Guidelines

- **Backwards Compatibility**: Avoid breaking changes when possible
- **Data Migration**: Include data migration scripts for complex changes
- **Rollback Plan**: Document how to rollback if needed
- **Testing**: Test migrations on copy of production data

## Documentation

### When to Update Documentation

**Required Updates:**
- New features or API changes → Update README, API docs
- Configuration changes → Update .env.example, setup guides  
- Database changes → Update schema documentation
- Bug fixes → Update troubleshooting guides

### Documentation Standards

- **Clear and Concise**: Write for developers of all levels
- **Code Examples**: Include working examples
- **Up-to-Date**: Keep documentation current with code changes
- **Consistent Style**: Follow existing documentation patterns

## Community Guidelines

### Code of Conduct

- **Be Respectful**: Treat all contributors with respect
- **Be Inclusive**: Welcome newcomers and different perspectives
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Understand that everyone has different experience levels

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Discord**: Real-time community chat
- **Pull Requests**: Code review and technical discussions

### Getting Help

**Stuck on Setup?**
- Check existing issues and discussions
- Ask in Discord #development channel
- Create GitHub discussion with setup details

**Need Code Review?**
- Keep PRs focused and reasonably sized
- Explain complex changes in PR description
- Be responsive to feedback

**Want to Contribute but Don't Know Where to Start?**
- Check issues labeled `good first issue`
- Look for `help wanted` labels
- Ask in Discord what areas need help

## Recognition

Contributors are recognized in several ways:

- **Contributors List**: Added to README.md
- **Changelog**: Major contributions noted in releases
- **Discord Role**: Special contributor role in community server
- **Early Access**: Beta features and preview releases

## Questions?

- **General Questions**: [GitHub Discussions](https://github.com/bingoscape/bingoscape-next/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/bingoscape/bingoscape-next/issues)
- **Real-time Chat**: [Discord Community](https://discord.gg/bingoscape)

Thank you for contributing to BingoScape Next! 🎯
# BingoScape Next

A comprehensive full-stack OSRS (Old School RuneScape) clan bingo management platform featuring sophisticated team management, real-time RuneLite plugin integration, and advanced progression systems.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [RuneLite Plugin Integration](#runelite-plugin-integration)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

### 🎯 **Advanced Bingo Systems**
- **Standard Bingo**: Traditional 5x5 grids with immediate tile access
- **Progression Bingo**: Tiered system with XP-based tier unlocking
- **Template System**: Save, share, and import custom bingo boards
- **Export/Import**: Full board data portability with v1.1 format support

### 👥 **Comprehensive Team Management**
- **Dynamic Team Formation**: Flexible team creation and member assignment
- **Role-Based Permissions**: Event admins, management, and participants
- **Team Progress Tracking**: Real-time submission status and completion rates
- **Auto Team Generator**: Intelligent team balancing algorithms

### 🔌 **RuneLite Plugin Integration**
- **Direct Screenshot Submission**: Upload evidence from in-game client
- **API Key Management**: Secure authentication for plugin access
- **Real-time Sync**: Live progress updates during gameplay
- **Multi-event Support**: Manage multiple concurrent bingo events

### 🏛️ **Clan Management**
- **Clan Hierarchies**: Admin, management, member, and guest roles
- **Event Assignment**: Associate events with specific clans
- **Invite System**: Secure clan and event invitation codes
- **Member Tracking**: Complete member activity and participation history

### 📊 **Advanced Analytics**
- **Event Statistics**: Comprehensive performance metrics
- **Progress Visualization**: Interactive charts and progress tracking
- **Submission Management**: Review, approve, and comment on submissions
- **Discord Integration**: Automated webhook notifications

### 🎨 **Modern UI/UX**
- **Dark-First Design**: Gaming-optimized dark theme
- **Responsive Layout**: Mobile-first responsive design
- **Accessibility**: Full ARIA support and keyboard navigation
- **Real-time Updates**: Live UI updates without page refreshes

## Architecture

**Full-Stack Next.js 14 Application**
```
Frontend: React 18 + TypeScript + Tailwind CSS + shadcn/ui
Backend: Next.js App Router + Server Actions + API Routes
Database: PostgreSQL + Drizzle ORM (19+ tables)
Authentication: NextAuth.js (Discord OAuth)
External: RuneLite Plugin API + Discord Webhooks + Sentry
```

### **Key Technical Features**
- **Type-Safe Database**: Comprehensive Drizzle ORM schema with relations
- **Server Actions**: Type-safe data mutations without REST overhead  
- **Component Architecture**: 30+ shadcn/ui components + 50+ business components
- **File Upload System**: Secure image handling with unique filename generation
- **API Key Authentication**: Bearer token system for external plugin access

## Tech Stack

### **Core Technologies**
- **[Next.js 14](https://nextjs.org/)** - React framework with App Router
- **[React 18](https://reactjs.org/)** - Frontend library with Server Components
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[PostgreSQL](https://www.postgresql.org/)** - Primary database
- **[Drizzle ORM](https://orm.drizzle.team/)** - Type-safe database toolkit

### **UI & Styling** 
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Accessible component library
- **[Radix UI](https://www.radix-ui.com/)** - Unstyled accessible components
- **[Framer Motion](https://www.framer.com/motion/)** - Animation library

### **Authentication & Security**
- **[NextAuth.js](https://next-auth.js.org/)** - Authentication framework
- **[Zod](https://zod.dev/)** - Runtime type validation
- **[Discord OAuth](https://discord.com/developers/docs/topics/oauth2)** - Primary auth provider

### **Development & Testing**
- **[Jest](https://jestjs.io/)** - Unit testing framework
- **[Playwright](https://playwright.dev/)** - End-to-end testing
- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting

### **External Integrations**
- **[RuneLite Plugin](https://runelite.net/plugin-hub/show/bingoscape-companion)** - OSRS client integration
- **[Discord Webhooks](https://discord.com/developers/docs/resources/webhook)** - Real-time notifications
- **[Sentry](https://sentry.io/)** - Error monitoring and performance tracking

## Getting Started

### Prerequisites

**Required:**
- [Node.js 18+](https://nodejs.org/) (LTS recommended)
- [PostgreSQL 14+](https://www.postgresql.org/) (for database)
- npm (comes with Node.js)

**Optional:**
- [Docker](https://www.docker.com/) (for containerized database)
- [Discord Application](https://discord.com/developers/applications) (for OAuth)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bingoscape/bingoscape-next.git
   cd bingoscape-next
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the following variables:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/bingoscape"
   
   # NextAuth
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Discord OAuth
   DISCORD_CLIENT_ID="your-discord-client-id"
   DISCORD_CLIENT_SECRET="your-discord-client-secret"
   ```

4. **Set up the database:**
   ```bash
   # Generate schema
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # (Optional) Open database studio
   npm run db:studio
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

### Quick Start with Docker

```bash
# Start PostgreSQL with Docker
docker-compose up -d

# Run the application
npm run dev
```

## RuneLite Plugin Integration

### Installing the Plugin

1. **Download RuneLite** from [runelite.net](https://runelite.net/)
2. **Install BingoScape Companion** from the [Plugin Hub](https://runelite.net/plugin-hub/show/bingoscape-companion)
3. **Generate API Key** in your BingoScape profile settings
4. **Configure Plugin** with your API key in RuneLite settings

### Plugin Features

- **Automatic Screenshot Upload**: Submit evidence directly from game
- **Event Synchronization**: View active bingo events in-game
- **Progress Tracking**: Real-time tile completion status
- **Multi-Account Support**: Use different API keys per account

### API Key Management

```typescript
// Generate new API key
POST /api/runelite/keys
Authorization: Bearer session-token

// Validate API key
POST /api/runelite/auth
Body: { "apiKey": "bsn_your_key_here" }
```

## API Documentation

### Authentication

**Session-based (Web UI):**
```typescript
// Automatic session handling via NextAuth.js
const session = await getServerAuthSession()
```

**API Key (RuneLite Plugin):**
```typescript
// Include in request headers
Authorization: Bearer bsn_your_api_key_here
```

### Key Endpoints

**Get User Events:**
```http
GET /api/runelite/events
Authorization: Bearer bsn_your_key
```

**Get Bingo Data:**
```http
GET /api/runelite/bingos/{bingoId}
Authorization: Bearer bsn_your_key
```

**Submit Screenshot:**
```http
POST /api/runelite/tiles/{tileId}/submissions
Authorization: Bearer bsn_your_key
Content-Type: multipart/form-data

image: <file>
```

**Full API Documentation:** Available at `/api/runelite/docs`

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run dbg          # Start with Node.js inspector

# Building
npm run build        # Build production application
npm run start        # Start production server

# Database
npm run db:generate  # Generate Drizzle schema
npm run db:migrate   # Run database migrations
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio

# Testing
npm run test         # Run Jest unit tests
npm run test:watch   # Run Jest in watch mode
npm run test:e2e     # Run Playwright E2E tests
npm run test:e2e:ui  # Run E2E tests with UI

# Code Quality
npm run lint         # Run ESLint
```

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions (mutations)
│   ├── api/               # API Routes
│   └── [routes]/          # Page components
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── [business]/       # Domain components
├── server/               # Backend logic
│   ├── auth.ts           # NextAuth configuration
│   └── db/               # Database schema & connection
└── lib/                  # Utility functions
```

### Database Schema

**Core Tables:**
- `events` - Bingo events and competitions
- `bingos` - Individual bingo boards within events
- `tiles` - Bingo tiles with goals and requirements
- `teams` - Team management and member assignments
- `submissions` - Screenshot submissions and reviews
- `users` - User accounts and authentication

**Key Relations:**
- Events → Bingos (one-to-many)
- Bingos → Tiles (one-to-many)
- Teams → Submissions (one-to-many)
- Users → TeamMembers (many-to-many via junction)

### Adding New Features

1. **Database Changes:** Update schema in `src/server/db/schema.ts`
2. **Server Actions:** Add mutations in `src/app/actions/`
3. **API Routes:** Add endpoints in `src/app/api/`
4. **Components:** Create components in `src/components/`
5. **Pages:** Add routes in `src/app/`

## Deployment

### Environment Setup

**Production Environment Variables:**
```env
# Database (use connection pooling for production)
DATABASE_URL="postgresql://user:pass@host:port/db?pgbouncer=true"

# Authentication (must be secure in production)
NEXTAUTH_SECRET="secure-random-string-64-chars"
NEXTAUTH_URL="https://your-domain.com"

# Discord OAuth (production app credentials)
DISCORD_CLIENT_ID="prod-client-id"
DISCORD_CLIENT_SECRET="prod-client-secret"

# Optional: Sentry (error monitoring)
SENTRY_DSN="https://your-sentry-dsn"
```

### Platform Deployment

**Vercel (Recommended):**
```bash
# Deploy to Vercel
npx vercel

# Set environment variables in Vercel dashboard
# Connect PostgreSQL database (Neon, Supabase, etc.)
```

**Docker:**
```dockerfile
# Use provided Dockerfile
docker build -t bingoscape-next .
docker run -p 3000:3000 bingoscape-next
```

**Manual Deployment:**
```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

### Database Migration

```bash
# For production deployments
npm run db:migrate
```

## Contributing

We welcome contributions! Please read our contributing guidelines:

### Development Process

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes** following our coding standards
4. **Add tests** for new functionality
5. **Run the test suite:** `npm run test && npm run test:e2e`
6. **Commit changes:** Follow conventional commit format
7. **Push to your fork:** `git push origin feature/amazing-feature`
8. **Open a Pull Request** with a clear description

### Code Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Follow project linting rules
- **Prettier**: Code formatting enforced
- **Testing**: Unit tests for business logic, E2E tests for user flows

### Commit Convention

```
feat: add progression bingo tier system
fix: resolve submission upload race condition
docs: update API documentation
test: add team management integration tests
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support & Community

- **Issues**: [GitHub Issues](https://github.com/bingoscape/bingoscape-next/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bingoscape/bingoscape-next/discussions)
- **Discord**: [BingoScape Community](https://discord.gg/bingoscape)

# Claude Code Memory - Bingoscape Next

## Project Overview
Full-stack Next.js application for OSRS clan bingo management with sophisticated team management, event creation, and RuneLite plugin integration.

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Server Actions, NextAuth (Discord OAuth)
- **Database**: PostgreSQL with Drizzle ORM
- **Integration**: RuneLite plugin API, Discord webhooks, Sentry monitoring

### Architecture
- App Router structure with server-side rendering
- Component-driven UI with shadcn/ui base + custom business components
- Database-first design with comprehensive schema relationships
- Server actions for type-safe mutations

---

## Current Session (Aug 4, 2025 - Session 2)

### Session Context
- **Started**: August 4, 2025
- **Branch**: main
- **Status**: Clean working tree (just completed comprehensive documentation overhaul)
- **Last Commit**: `114ef65` - docs: comprehensive documentation overhaul

### Session Goals
✅ **COMPLETED**: UI Enhancement - Event Card Navigation

### Completed Work

#### 1. Event Card UI Enhancement
**File Modified**: `src/components/event-card.tsx`
**Problem**: Event cards had a "View Event" button at the bottom, requiring users to click specifically on the button to navigate to the event details.
**Solution**: Made the entire event card clickable while maintaining functionality of interactive elements.

**Changes Made**:
- Wrapped entire card in Link component pointing to event URL
- Removed "View Event" button from card footer  
- Added event propagation prevention (`e.stopPropagation()`) to interactive elements:
  - Join/Request buttons
  - Status view links
  - Form inputs and submit buttons
- Simplified footer logic to only show action buttons when relevant
- Maintained all existing hover effects and visual feedback

**Result**: 
- ✅ Cleaner, more intuitive card design
- ✅ Entire card surface is clickable
- ✅ All interactive elements still function properly
- ✅ Better user experience with larger click target
- ✅ Maintains existing styling and accessibility

---

## Previous Session (Aug 4, 2025)

### Completed Work

#### 1. Progression Board Export/Import Implementation
**Files Modified**: `src/app/actions/bingo-import-export.ts`
**Commit**: `3e5ed2d` - Added progression-bingos to import

**Problem Solved**: Export/import functionality only supported standard bingo boards, but progression boards (a newer board type with tiers and XP requirements) were not supported.

**Solution Implemented**:
- Updated `ExportedBingo` interface to include:
  - `bingoType: "standard" | "progression"`
  - `tiersUnlockRequirement?: number`
  - `tier: number` field on tiles
  - `tierXpRequirements?: Array<{tier: number, xpRequired: number}>`
- Enhanced export function to fetch and include tier XP requirements
- Updated import function to handle progression-specific fields with backwards compatibility
- Improved validation to support both board types
- Version bumped to "1.1" for new exports

**Key Features**:
- ✅ Full backwards compatibility with existing v1.0 exports
- ✅ Supports both standard (tier 0) and progression (multi-tier) boards
- ✅ Includes tier XP requirements for progression boards
- ✅ Proper validation for all progression-specific fields

#### 2. Code Quality Improvements
**Files Modified**: `src/app/api/submissions/[id]/comments/route.ts`
**Commit**: `0e1a612` - fix(api): resolve ESLint warnings in submission comments route

**Changes**:
- Added eslint-disable for necessary any type usage
- Fixed non-null assertion warnings
- Resolved formatting and trailing whitespace issues

### Technical Decisions

#### Export/Import Schema Design
- **Version Strategy**: Incremental versioning (1.0 → 1.1) for new features
- **Backwards Compatibility**: Old exports default to `bingoType: "standard"` and `tier: 0`
- **Optional Fields**: Progressive enhancement with optional fields for new features
- **Validation**: Comprehensive validation with specific error messages

#### Database Integration
- **Tier System**: Uses existing `tier` field on tiles (0 for standard, 1+ for progression)
- **XP Requirements**: Leverages `tierXpRequirements` table for progression boards
- **Transactional**: All imports wrapped in database transactions for data integrity

### Database Schema Context

#### Key Tables for Bingo System:
- `bingos`: Core bingo board with `bingoType` enum ("standard", "progression")
- `tiles`: Individual bingo tiles with `tier` field for progression
- `goals`: Task objectives within each tile
- `tierXpRequirements`: XP thresholds for unlocking progression tiers
- `teamTierProgress`: Tracks which tiers teams have unlocked

#### Bingo Board Types:
1. **Standard**: Traditional 5x5 grid, all tiles available immediately (tier 0)
2. **Progression**: Tiered system where completing tiles gives XP to unlock higher tiers

### File Structure Overview
```
src/
├── app/
│   ├── actions/
│   │   ├── bingo-import-export.ts      # Export/import functionality
│   │   ├── bingo.ts                    # Bingo CRUD operations
│   │   └── events.ts                   # Event management
│   ├── api/                           # REST API endpoints
│   └── [routes]/                      # App Router pages
├── components/
│   ├── bingo-import-export-modal.tsx  # UI for export/import
│   ├── progression-bingo-grid.tsx     # Progression board display
│   └── ui/                           # shadcn/ui components
└── server/
    ├── db/
    │   ├── schema.ts                  # Drizzle schema definitions
    │   └── index.ts                   # Database connection
    └── auth.ts                        # NextAuth configuration
```

### Development Workflow
- **Linting**: ESLint with TypeScript rules (warnings acceptable, errors block build)
- **Building**: Next.js build process with type checking
- **Database**: Drizzle migrations for schema changes
- **Testing**: Jest + Playwright for unit/e2e testing

---

## Next Steps & Recommendations

### Immediate
- Test progression board export/import in UI to ensure full functionality
- Consider adding import preview to show board structure before import

### Future Enhancements
- Export validation could include tile count vs grid dimensions check
- Consider adding export metadata (created date, creator info)
- Template system integration with export/import functionality

### Technical Debt
- Multiple ESLint warnings across codebase (non-blocking but should be addressed)
- Some unused imports and variables in various files
- Consider consolidating similar API error handling patterns

---

## Important Context for Future Sessions

### Code Patterns to Follow
- Use server actions for data mutations (files in `src/app/actions/`)
- Follow shadcn/ui component patterns for UI consistency
- Use Drizzle queries with relations for complex data fetching
- Maintain backwards compatibility for data formats

### Testing Approach
- Export/import functions are server actions (need integration testing)
- UI components can be unit tested with React Testing Library
- Database operations should be tested with actual DB transactions

### RuneLite Integration
- API endpoints in `src/app/api/runelite/` handle plugin communication
- Submission system allows players to upload screenshots from game
- Authentication system supports API keys for plugin access
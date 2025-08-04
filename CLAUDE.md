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

## Current Session (Aug 4, 2025 - Session 4)

### Session Context
- **Started**: August 4, 2025
- **Branch**: main
- **Status**: Ready for new development - previous session completed successfully
- **Last Commit**: `b85eae3` - feat(ui): enhance participants page with improved buy-in tracking and visual design

### Session Goals
🎯 **IN PROGRESS**: Fix Build Errors and ESLint Issues

#### Tasks:
1. ✅ Identify build issues from build.log
2. ✅ Fix null-coalescing operator errors in donation-management-modal.tsx
3. ✅ Fix no-floating-promises errors in multiple components
4. ✅ Clean up unused imports and variables (major ones)
5. 🔄 Verify build passes successfully

#### Completed Fixes:
- **Null-coalescing operators**: Fixed 3 instances of `||` to `??` in donation-management-modal.tsx
- **Floating promises**: Added `void` operator to async calls in event-card.tsx and prize-pool-breakdown.tsx
- **Unused imports**: Removed unused imports from multiple components
- **Type imports**: Fixed consistent-type-imports issues

---

## Previous Session (Aug 4, 2025 - Session 3)

### Session Context
- **Started**: August 4, 2025
- **Branch**: main
- **Status**: Major feature enhancement - buy-in tracking and UI/UX overhaul
- **Last Commit**: `b85eae3` - feat(ui): enhance participants page with improved buy-in tracking and visual design

### Session Goals
✅ **COMPLETED**: Buy-In Tracking Enhancement & Comprehensive UI/UX Improvements

### Completed Work

#### 1. Buy-In Tracking System Overhaul
**Files Modified**: 
- `src/app/actions/events.ts`
- `src/app/events/[id]/participants/page.tsx`
- `src/server/db/schema.ts`

**Problem**: Buy-in tracking used confusing number inputs, and there was no system for tracking donations separately from buy-ins.

**Solution**: Complete redesign of financial tracking with checkbox-based buy-ins and comprehensive donation management.

**Key Changes**:
- **Checkbox-Based Buy-Ins**: Replaced number inputs with intuitive checkboxes
  - Checked = participant paid minimum buy-in amount
  - Unchecked = participant hasn't paid (0 GP)
  - Clear "Paid/Unpaid" labels for immediate understanding
- **Donation Tracking System**: 
  - New `eventDonations` database table with participant relationships
  - Modal-based donation management interface
  - Support for multiple donations per participant with descriptions
- **Enhanced Prize Pool Logic**:
  - Fixed calculation bug in `getTotalBuyInsForEvent` (was double-counting base prize pool)
  - Separate calculation for base pool + buy-ins + donations
  - Real-time updates across all components

#### 2. Comprehensive UI/UX Design Overhaul
**Files Created/Modified**:
- `src/components/prize-pool-breakdown.tsx` (new)
- `src/components/donation-management-modal.tsx` (new)
- `src/app/events/[id]/participants/page.tsx`

**Problem**: The participants page had poor visual hierarchy, confusing interactions, and dense information presentation.

**Solution**: Complete UI/UX redesign following modern design principles.

**Visual Improvements**:
- **Enhanced Visual Hierarchy**:
  - Larger, more prominent page titles (`text-4xl` with `tracking-tight`)
  - Better breadcrumb spacing and visibility
  - Minimum buy-in displayed as clean badge instead of plain text
- **Redesigned Prize Pool Component**:
  - Gradient background with amber theming for prominence
  - Grid-based breakdown with circular icon containers
  - Color-coded categories (blue=base, green=buy-ins, red=donations)
  - 3-column layout with percentages and visual hierarchy
- **Improved Table Design**:
  - Buy-in checkboxes with background containers and clear labels
  - Compact donation management buttons (icon-only with hover states)
  - Status badges replacing ambiguous icons ("Verified/Pending")
  - Consistent green/orange color theming throughout
- **Mobile Optimization**:
  - Matching interaction patterns between desktop and mobile
  - Optimized touch targets and spacing
  - Consistent visual design across breakpoints

#### 3. Database Schema Enhancements
**Files Modified**: 
- `src/server/db/schema.ts`
- Database migration: `drizzle/0006_dark_ezekiel.sql`

**New Tables Added**:
```sql
eventDonations {
  id: uuid (primary key)
  eventParticipantId: uuid (foreign key to eventParticipants)
  amount: bigint (donation amount)
  description: text (optional description)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Enhanced Relations**:
- `eventParticipantsRelations` now includes donations relationship
- Proper cascade deletion for data integrity
- Optimized queries for participant financial data

### Technical Decisions

#### Buy-In Logic Architecture
- **Boolean State Management**: Simplified from complex number inputs to clear paid/unpaid states
- **Server Action Enhancement**: `updateParticipantBuyIn` now accepts boolean and calculates amount
- **Database Efficiency**: Only create buy-in records when participant has actually paid
- **UI Consistency**: Matching checkbox patterns across desktop table and mobile cards

#### Prize Pool Calculation Strategy
- **Separation of Concerns**: Base pool, buy-ins, and donations calculated separately
- **Real-time Updates**: Components refresh automatically when financial data changes
- **Visual Hierarchy**: Most important info (total) gets prominent display treatment
- **Performance**: Efficient database queries with proper joins and aggregations

#### Component Architecture
- **Modular Design**: Separate components for prize pool breakdown and donation management
- **Reusable Patterns**: Consistent interaction patterns across similar UI elements
- **Accessibility**: Proper ARIA labels, keyboard navigation, and screen reader support
- **Responsive Design**: Mobile-first approach with desktop enhancements

### Results Achieved
- ✅ **Intuitive Financial Management**: Clear checkbox-based buy-in tracking
- ✅ **Comprehensive Donation System**: Multi-donation support with descriptions
- ✅ **Professional UI Design**: Modern visual hierarchy and interaction patterns
- ✅ **Improved User Experience**: Reduced cognitive load and clearer affordances
- ✅ **Better Information Architecture**: Prominent prize pool display with breakdown
- ✅ **Consistent Design Language**: Unified color theming and visual patterns
- ✅ **Mobile Optimization**: Touch-friendly interactions and responsive layouts
- ✅ **Data Integrity**: Proper database relationships and cascade handling

---

## Previous Session (Aug 4, 2025 - Session 2)

### Session Goals
✅ **COMPLETED**: UI Enhancement - Event Card Navigation

### Completed Work

#### 1. Event Card UI Enhancement
**File Modified**: `src/components/event-card.tsx`
**Commit**: `ea4f989` - feat(ui): make entire event card clickable for navigation

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
│   │   └── events.ts                   # Event management & financial tracking
│   ├── api/                           # REST API endpoints
│   ├── events/[id]/
│   │   ├── participants/page.tsx       # Enhanced participants management UI
│   │   └── page.tsx                    # Event details with prize pool integration
│   └── [routes]/                      # App Router pages
├── components/
│   ├── bingo-import-export-modal.tsx  # UI for export/import
│   ├── donation-management-modal.tsx  # NEW: Donation tracking interface
│   ├── prize-pool-breakdown.tsx       # NEW: Enhanced prize pool component
│   ├── progression-bingo-grid.tsx     # Progression board display
│   └── ui/                           # shadcn/ui components
└── server/
    ├── db/
    │   ├── schema.ts                  # Enhanced with donation tracking tables
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
- **Database Migration**: Apply the new `eventDonations` table migration in production
- **Testing**: Comprehensive testing of donation management system with multiple scenarios
- **Performance**: Monitor database query performance with new donation joins
- **Mobile Testing**: Verify improved mobile experience across different devices

### Future Enhancements
- **Bulk Operations**: Add bulk buy-in/donation management for multiple participants
- **Payment Integration**: Consider integrating with payment processors for actual transactions
- **Export/Import Enhancement**: Include financial data in bingo export/import functionality
- **Analytics Dashboard**: Prize pool trends and participant payment analytics
- **Notification System**: Automated reminders for unpaid buy-ins

### Technical Debt
- **ESLint Warnings**: Address remaining linter warnings across codebase
- **Component Consolidation**: Extract shared patterns from table/card participant displays
- **Error Handling**: Standardize error handling patterns across financial operations
- **Performance Optimization**: Consider implementing optimistic updates for buy-in changes
- **Accessibility Audit**: Full accessibility review of new interactive elements

### Architecture Considerations
- **Caching Strategy**: Implement caching for prize pool calculations on high-traffic events
- **Event Sourcing**: Consider event sourcing for financial transactions audit trail
- **Data Validation**: Add client-side validation for donation amounts and descriptions

---

## Important Context for Future Sessions

### Code Patterns to Follow
- **Server Actions**: Use server actions for data mutations (files in `src/app/actions/`)
- **UI Components**: Follow shadcn/ui component patterns for consistency
- **Database Queries**: Use Drizzle queries with relations for complex data fetching
- **Financial Operations**: Always wrap financial transactions in database transactions
- **State Management**: Use optimistic updates for immediate UI feedback
- **Error Handling**: Provide clear, actionable error messages for financial operations
- **Accessibility**: Ensure all interactive elements have proper ARIA labels and keyboard navigation

### Testing Approach
- **Financial Logic**: Unit test buy-in and donation calculations with edge cases
- **UI Components**: Test checkbox interactions and modal behaviors with React Testing Library
- **Database Operations**: Integration tests with actual DB transactions for financial data
- **Mobile Responsive**: Visual regression tests for mobile card layouts
- **Performance**: Load tests for prize pool calculations with large participant counts

### Design System Guidelines
- **Color Theming**: Green for positive/paid states, orange for pending, red for errors
- **Interactive Elements**: Minimum 44px touch targets for mobile accessibility
- **Information Hierarchy**: Most critical info (totals) gets prominent visual treatment
- **Consistent Spacing**: Use consistent gap and padding values across similar components
- **Loading States**: Always provide loading indicators for financial operations

### RuneLite Integration
- API endpoints in `src/app/api/runelite/` handle plugin communication
- Submission system allows players to upload screenshots from game
- Authentication system supports API keys for plugin access

### Database Schema Best Practices
- **Financial Data**: Use bigint for all monetary amounts to avoid precision issues
- **Cascade Deletion**: Proper cascade rules for data integrity when removing participants
- **Timestamps**: Always include created/updated timestamps for audit trails
- **Relations**: Use proper foreign key constraints and relations for data consistency
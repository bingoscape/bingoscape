# Changelog

All notable changes to BingoScape Next will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- One read policy for Event data (`src/lib/authz/read-policy.ts`, `src/server/authz/read.ts`): `canReadEvent`, `canReadBoard`, `canReadTile`, `canReadGoal` and `canReadTeam` decide what a viewer (manager, participant, member of another Team, outsider, anonymous) may read, for public and private Events alike. Optional `RBAC_READ_POLICY=enforce|relaxed` (default `enforce`, read per request) relaxes the membership gates without a rebuild; see `.env.example` and `docs/GITHUB-SECRETS.md`
- `docs/adr/0001-read-visibility-defaults.md` records decisions 3-5 of the RBAC epic (#183) with today's behaviour as the default, pending maintainer confirmation: link holders of a non-public Event get the join card only, uploads are served by public URL, the codephrase is visible to participants. Each is a one-line constant (`READ_DECISIONS`)
- Transfer Event ownership (`transferEventOwnership` server action, owner-only): the new owner must be a participant, becomes the creator and an admin; the previous owner stays an admin
- Migration 0039: safety-net trigger on `event_participants` / `clan_members` that logs writes outside the membership helper to `role_change_log` with source `trigger`, plus a catch-up of ledger entries missing since 0038. See `docs/DATABASE-MIGRATION.md`, "RBAC 3/8 rollout"
- Daily RBAC reconciliation: `GET /api/cron/rbac-reconcile` (bearer `CRON_SECRET`) runs the verification queries and answers 500 on findings; `scripts/rbac-reconcile.sh` and `scripts/setup-rbac-reconcile-cron.sh` run it from host cron and alert via the backup Discord webhook
- **RuneLite API 2.1 (progression and battleship boards)** - All changes are additive
  - `apiVersion: "2.1"` on every board payload
  - `/api/runelite/events` lists boards of every type (standard, progression, battleship); hidden boards stay excluded
  - `progression.tiers[]` (per-tier unlock state, earned XP and XP required) and stub tiles (`tierLocked`) for locked tiers
  - `battleship` block with the team's hit/miss/sunk marks, ship rules and opponent ship counts, plus `tiles[].isBlind`
  - `tierUnlocked` on submission, auto-submission and item-check responses, and `shot` on battleship (auto-)submission responses
  - Error codes `TIER_LOCKED`, `BOARD_BLIND` and `EVENT_NOT_STARTED`
  - `ETag` / `If-None-Match` (`304`) on `GET /api/runelite/bingos/{bingoId}`, with a rate limit of 60 requests per minute per user
- Battleship boards: after the event has started, players can draw their own team's ships on the board with a "My ships" toggle (off by default, remembered per device). The hull is shown as placed and never shows damage; tiles also announce "your ship (length N)" to screen readers, and the legend and tile panel explain it. Only the viewer's own team is shown, the layout comes from the server, and nothing is exposed before the event starts
- Battleship boards: managers (also those on no team) get a "View fleets" link to the read-only fleet page once the event has started
- Comprehensive project documentation overhaul
- Detailed API documentation for RuneLite plugin integration
- Architecture documentation with technical specifications
- Development setup and deployment guides

### Changed

- **Behaviour change (reads):** the read paths now apply the same rules. Before, several server-side reads answered any caller who had an id, even a non-member or an anonymous one. Now:
  - `getEventById` gives non-members only the Event row (the join card the Event page showed anyway), not Boards, Teams, Submissions or secrets. An Event that does not exist, or (with `members-only`) one hidden from the viewer, answers 404.
  - `getMiniBoardTiles`, `getBingoById`, the Goal / Tile readers (`getTileGoalsAndProgress`, `getGoalTree`, `getGoalValues`, `getGoalWithItemData`, `getItemGoalsForTile`), event and Board statistics, item statistics, pattern completion, `getTeamsByEventId` and `calculateEventPrizePool` need membership of the Event, or a public Event for the content a public page shows (Boards, Tiles, leaderboard, Teams, prize pool). Per player statistics, item statistics and pattern completion are for participants and managers only.
  - Boards that are not visible (drafts) are for managers on every read path; before, statistics and `getBingoById` listed them to everybody.
  - `getBingoById` no longer hands the tracker verification code and the codephrase to every caller: the verification code is for managers, the codephrase for participants and managers.
  - A Team's goal progress on a battleship Board is for that Team and managers only (`getTileGoalsAndProgress`, `getGoalTree`, `getGoalTreeWithProgress`), as `getEventById` already did. Titles and item names of hidden Tiles are left out of the statistics for non-managers.
- **RBAC 6/8 (#189): the UI gets server computed capabilities.** `EventCapabilities` (`src/lib/authz/capabilities.ts`, `getEventCapabilities` in `src/server/authz`) is computed once per request from the cached actor and passed to components as props; components no longer receive a `userRole` string or compare roles (the grep gate allowlist lost every UI entry). The participants page and the Board submissions page are Server Components that fetch their data and render a client child, so the made-up `"participant"` role shown while a client fetch failed is gone. The `(manage)` pages (participants, Board submissions, admin, teams, new Board) are gated once in their layout: a member without the manager capability is sent back to the Event page. Pages every member may open (statistics, Board statistics, ship placement, registration status, old Board links) moved to a new `(member)` route group; their URLs are unchanged.
  - Participants table: the controls follow the permission map. Management no longer sees "Change role" (only admins may change roles), and the role select offers only the roles the user may grant (a non-owner admin cannot grant admin). Event delete in the menu is shown to the owner only. The server already refused these; the buttons are gone instead of failing.
  - Board submissions page: after a status change or a delete the list reloads.
- **RBAC 5/8 (#188): every call site asks the policy.** Server actions, route handlers and server pages no longer compare role strings; they use `authorize`, `requirePermission`, `hasPermission` or the `requirePermissionFor<Resource>` resolvers (`src/server/authz`), backed by the permission map. Who may do what is unchanged, except for the holes closed under "Fixed". New permissions reproduce today's rules: `stats:read`, `player-metadata:read` / `:write` / `:write-own`, `submission:create-on-behalf`, `event:override-registration`
- **Return shapes (behaviour change for callers):** mutations return `{ success: true, ... }` or `{ success: false, error, code? }` (`code`: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID`, `CONFLICT`, `FAILED`) instead of throwing. Changed: `updateEvent`, `assignEventToClan`, `generateEventInviteLink` (`{ success, invite }`), `joinEventViaInvite` (`{ success, event, pendingApproval }`), `requestToJoinEvent`, `updateParticipantRole`, `assignParticipantToTeam`, `approve` / `rejectRegistrationRequest`, `add` / `update` / `removeParticipantDonation`, `updatePlayerMetadata` / `updateOwnPlayerMetadata` (`{ success, metadata }`), `deletePlayerMetadata`, `getClanMembersForEvent` (`{ success, members }`), `markNotificationAsRead`. Reads that return data keep their type and answer the empty value when the caller may not see the data instead of throwing (`getEventParticipants`, `getRegistrationRequests`, `getDiscordWebhooks`, `getTierXpRequirements`, `getAllSubmissionsForTeam`, `getUserClans`, `getEventTeamStatistics` now `null`). The convention is written down in `src/server/authz/guards.ts`. All callers (client components, toasts) were updated; the participants table, buy-in, remove and bulk remove now show the server's error instead of reporting success
- Denial messages are the policy's ("Forbidden: insufficient permissions") instead of per-action strings such as "Unauthorized" or "Only admins can manage rules"; `error` strings that carried database messages (`deleteEventByAdmin`, `joinEvent`) are replaced by a fixed message
- `src/app/actions/bingo/core.ts` (an unused duplicate of `createBingo` / `updateBingo` / `deleteBingo`, one of which returned the codephrase without any check) and `src/app/actions/checkCircularReference.ts` (unused, no authorization) are deleted; so are the unused, unauthenticated `getTotalBuyInsForEvent` and `getUserCreatedEvents`, and the unused `getEventParticipantsWithTeams`
- RuneLite routes load the caller's standing in the Event with `getApiActor(req, eventId)` (one actor loader for the web app and the API) instead of four copies of the participant / creator lookup. A creator without a participant row is treated as admin on every route, as on the web
- Registry test (`src/server/__tests__/registry.test.ts`): every export of a `"use server"` file and every route handler method must be registered with its policy in `src/server/authz/registry.ts`, found by scanning the source. Cross-Event test (`cross-event.test.ts`) calls every id-taking action with a resource of another Event. A temporary grep test (`role-comparisons.test.ts`) fails on inline `"admin"` / `"management"` comparisons outside `src/lib/authz` and `src/server/authz` until the lint rule of phase 8 replaces it; UI components that still branch on a role prop are on its allowlist (phase 6)
- Query and helper functions moved out of `"use server"` modules, so they are no longer client-callable endpoints: `getEventById` / `getEvents` (`src/server/queries/events.ts`), the tile completion rules (`src/server/tile-completion.ts`), `recalculateGoalProgress` (`src/server/goal-progress.ts`), the pattern bonus maths (`src/server/pattern-completion.ts`), and the statistics, item statistics and event pattern completion queries (`src/server/queries/`). `getMiniBoardTiles`, `getBingoById`, `getTeamsByEventId`, `calculateEventPrizePool` and the Goal readers stay in `src/app/actions/` as entry points that check the policy
- **Behaviour change (owner-only actions):** deleting an Event, granting the admin role (by changing a role or adding a participant) and the new ownership transfer are now reserved to the Event owner (the creator). Before, every admin could do these. Other admins keep all other admin permissions. If the creator account no longer exists, the Event's oldest admin counts as the owner. Super-admin actions are unchanged.
- Event and Clan memberships are written in one place (`src/server/authz/membership.ts`): joining, invites, registration approval, adding Clan members, role changes, removal, leaving a Clan, creating an Event or Clan, and the super-admin member actions. The Event or Clan row is locked while a role changes, so two simultaneous demotions can no longer remove the last admin; an Event and a Clan always keep an admin, and the owner cannot be demoted or removed. Every change is recorded in `role_change_log` (and refusals in `event_audit_log`).
- Removing an Event participant as super admin now also removes their Team place, buy-ins and donations, and refuses to remove or demote the Event creator (transfer ownership first). Setting a Clan owner as super admin requires the new owner to be a Clan member and makes them an admin.
- Database: event participants and team memberships are now unique per Event (duplicates are removed into quarantine tables by migration 0038), `team_members` gets an `event_id`, creators always have an admin participant row, and `role_change_log` / `event_audit_log` tables are added (not written yet). See `docs/DATABASE-MIGRATION.md`, "RBAC 2/8 rollout"
- Adding a Player to a Team now fails with "User is already on a team in this event" when they are on another Team of that Event
- `GET /api/runelite/bingos/{bingoId}` now serves battleship boards and requires the caller to be a participant or manager of the event (hidden boards: managers only); every other case answers `404`
- `apiKeys.lastUsed` is written at most once a minute per key
- Updated README.md to accurately reflect application capabilities
- Rewrote README.md against the current code: Next.js 16 / React 19 / Node 24 / PostgreSQL 18, all three board types, the full environment variable reference, the Docker, CI and backup flow, testing, the RuneLite API 2.1 endpoints and the BSD 2-Clause license. Local database name is now `bingoscape` in `.env.example`, `start-database.sh` and the docs; `.env.example` no longer lists `?pgbouncer=true` or the unused `GE_PRICE_CACHE_TTL_MINUTES` and documents `WISEOLDMAN_API_KEY`
- Enhanced project structure documentation
- Reworked `docs/CONTRIBUTING.md`: current commands (`npm run lint -- --fix`, `npx tsc --noEmit`), the real Prettier style, the server action and authorization rules from AGENTS.md, migration compatibility rules, what CI runs and test setup (Docker required)
- Improved contributing guidelines with code standards

### Fixed

- Holes closed by the migration (each a deliberate behaviour change):
  - `fetchPlayerDataFromWOM`, `updatePlayerOnWOM` and `fetchCompetitionFromWOM` answered anonymous callers and spent the server's WiseOldMan quota; they now need a signed-in user
  - `getTotalBuyInsForEvent` (any Event's buy-in total, anonymous) is gone
  - `getSelectableUsersForSubmission` listed the members of any Team id to any caller; non-managers now get their own Team only
  - `initializeTeamTierProgress` / `checkAndUnlockNextTier` accepted a Board of a different Event than the Team's; the Board must belong to the Team's Event
  - `removeParticipantDonation` reported success for a donation of another Event; it now answers "Donation not found"
- Progression boards: tier 0 is always unlocked, so a fresh team no longer gets an empty board from the RuneLite API
- Progression boards: completions through the RuneLite plugin, trackers and goal progress now unlock the next tier(s)
- Progression boards: submitting to a locked tier is refused on every submit path (`TIER_LOCKED`)
- Battleship boards: the RuneLite board payload redacts blind tiles, and submissions respect the event start

## [1.1.0] - 2025-08-04

### Added

- **Progression Bingo Export/Import Support** - Full export/import functionality for progression bingo boards
  - Added `bingoType` field to exported data ("standard" | "progression")
  - Added `tiersUnlockRequirement` field for progression boards
  - Added `tier` field to tile exports for multi-tier boards
  - Added `tierXpRequirements` array for tier progression data
- **Enhanced Bingo Import System** - Improved import functionality with backwards compatibility
  - Support for both v1.0 (standard) and v1.1 (progression) export formats
  - Automatic detection and handling of progression vs standard bingo types
  - Comprehensive validation for progression-specific fields
  - Transactional imports to ensure data integrity

### Changed

- **Export Format Version** - Bumped export format from v1.0 to v1.1
  - Maintains full backwards compatibility with v1.0 exports
  - Default values ensure smooth upgrades (tier: 0, bingoType: "standard")
- **Import Validation** - Enhanced validation system for bingo imports
  - Specific error messages for invalid progression configurations
  - Proper handling of tier XP requirements and bingo type validation

### Fixed

- **ESLint Warnings** - Resolved ESLint warnings in submission comments route
  - Added proper eslint-disable comments for necessary any type usage
  - Fixed non-null assertion warnings
  - Resolved formatting and trailing whitespace issues

## [1.0.0] - 2025-07-XX

### Added

- **Core Bingo Management System**
  - Full-featured bingo board creation and management
  - Standard 5x5 bingo grids with customizable tiles and goals
  - Real-time progress tracking and submission system
  - Comprehensive team management with role-based permissions

- **RuneLite Plugin Integration**
  - Direct screenshot submission from OSRS game client
  - API key authentication system for secure plugin access
  - Real-time synchronization between game and web platform
  - Multi-event support for concurrent bingo competitions

- **Advanced User Management**
  - Discord OAuth authentication integration
  - Role-based access control (admin, management, participant)
  - Comprehensive user profiles with RuneScape name linking
  - API key management for external application access

- **Team & Event Management**
  - Dynamic team formation with flexible member assignment
  - Event creation with customizable parameters and deadlines
  - Registration approval system for event participation
  - Auto team generator with intelligent balancing algorithms

- **Clan System**
  - Hierarchical clan structure with multiple role levels
  - Clan-based event organization and management
  - Secure invitation system for clan and event joining
  - Member activity tracking and participation history

- **Submission & Review System**
  - Image upload handling with secure file management
  - Multi-stage approval workflow for submissions
  - Comment system for submission reviews and feedback
  - Discord webhook integration for real-time notifications

- **Progressive Bingo System**
  - Tiered progression system with XP-based unlocking
  - Configurable tier requirements and progression paths
  - Team tier progress tracking and visualization
  - Advanced progression analytics and reporting

- **Template System**
  - Bingo board template creation and sharing
  - Template gallery with public/private visibility options
  - Import/export functionality for template portability
  - Template categorization and search functionality

- **Modern UI/UX**
  - Dark-first design optimized for gaming sessions
  - Fully responsive mobile-first design approach
  - Comprehensive accessibility features and ARIA support
  - Real-time UI updates without page refreshes

- **Analytics & Reporting**
  - Comprehensive event statistics and performance metrics
  - Interactive progress visualization and charts
  - Team performance analysis and comparison tools
  - Export capabilities for data analysis

### Technical Implementation

- **Next.js 14 App Router** - Modern React framework with server components
- **TypeScript** - Full type safety throughout application stack
- **PostgreSQL + Drizzle ORM** - Robust database with 19+ tables and relations
- **shadcn/ui + Tailwind CSS** - Modern component library and utility-first styling
- **NextAuth.js** - Secure authentication with Discord OAuth integration
- **Server Actions** - Type-safe data mutations without REST API overhead
- **Comprehensive Testing** - Jest unit tests and Playwright E2E testing
- **Error Monitoring** - Sentry integration for production error tracking

### Security

- **API Key Authentication** - Secure bearer token system for external access
- **Input Validation** - Comprehensive Zod schema validation throughout
- **File Upload Security** - Secure file handling with proper sanitization
- **Role-based Authorization** - Granular permission system for all operations

### Developer Experience

- **TypeScript Strict Mode** - Maximum type safety and developer confidence
- **ESLint + Prettier** - Consistent code formatting and quality standards
- **Comprehensive Documentation** - Full API documentation and developer guides
- **Database Migrations** - Versioned schema changes with Drizzle migrations

## Migration Guide

### From v1.0 to v1.1

The v1.1 update introduces progression bingo support while maintaining full backwards compatibility:

**Database Changes:**

- No manual migration required - all changes are handled automatically
- Existing standard bingo boards continue to work unchanged
- New progression features are opt-in and don't affect existing functionality

**Export/Import Changes:**

- v1.0 exports continue to work with v1.1 import system
- v1.1 exports include additional progression fields but maintain compatibility
- No action required for existing templates or saved exports

**API Changes:**

- All existing API endpoints remain unchanged
- New optional fields added to responses (backwards compatible)
- RuneLite plugin continues to work without updates

## Support

For questions, issues, or feature requests:

- **GitHub Issues**: [Report bugs or request features](https://github.com/bingoscape/bingoscape/issues)
- **GitHub Discussions**: [Community discussions and support](https://github.com/bingoscape/bingoscape/discussions)
- **Discord**: [Join our community server](https://discord.gg/bingoscape)

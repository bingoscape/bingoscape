# Changelog

All notable changes to BingoScape Next will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive project documentation overhaul
- Detailed API documentation for RuneLite plugin integration
- Architecture documentation with technical specifications
- Development setup and deployment guides

### Changed
- Updated README.md to accurately reflect application capabilities
- Enhanced project structure documentation
- Improved contributing guidelines with code standards

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
- **GitHub Issues**: [Report bugs or request features](https://github.com/bingoscape/bingoscape-next/issues)
- **GitHub Discussions**: [Community discussions and support](https://github.com/bingoscape/bingoscape-next/discussions)
- **Discord**: [Join our community server](https://discord.gg/bingoscape)
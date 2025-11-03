# Implementation Plan - OR Goal Completion Requirement Configuration
**Created**: 2025-11-03
**Feature**: Configurable target value for OR goal groups

## Source Analysis
- **Source Type**: Feature description/requirement
- **Core Features**: Add ability to specify how many goals must be completed in an OR group (default: 1, configurable to any number)
- **Dependencies**: Existing Drizzle ORM schema, goal group system
- **Complexity**: Medium - requires database schema change, UI updates, and completion logic modification

## Current Implementation Analysis

### Database Schema (`src/server/db/schema.ts`)
- **Goal Groups Table** (line 299-311):
  - Has `logicalOperator` enum: "AND" | "OR"
  - Currently no field for minimum required completions in OR groups
  - Need to add: `minRequiredGoals` field (integer, default: 1)

### Goal Group Logic (`src/app/actions/goal-groups.ts`)
- **createGoalGroup** function (line 52-84): Creates groups with operator
- **updateGoalGroup** function (line 89-127): Updates operator and name
- Need to add `minRequiredGoals` parameter support

### UI Components
1. **Goal Tree Editor** (`src/components/goal-tree-editor.tsx`):
   - Line 688-695: Shows OR description as "at least one goal required"
   - Line 958-969: Dropdown for AND/OR selection
   - Need to add: Input field for minimum required goals (shown when OR is selected)

2. **Goal Progress Tree** (`src/components/goal-progress-tree.tsx`):
   - Line 83-85: OR logic checks if ANY child is complete
   - Line 88-93: Display logic for OR groups shows "X / 1"
   - Need to update: Check against `minRequiredGoals` instead of hardcoded 1

### Completion Evaluation (`src/app/actions/tile-completion.ts`)
- **evaluateGroup** function (line 41-94):
  - Line 82-84: OR completion checks `children.some((child) => child.isComplete)`
  - Need to update: Count completed children and compare to `minRequiredGoals`

## Target Integration

### Integration Points
1. Database schema addition
2. Goal group creation/update actions
3. UI for group configuration (creation + editing)
4. Completion evaluation logic
5. Progress display logic

### Affected Files
1. `src/server/db/schema.ts` - Add field to goalGroups table
2. Database migration file - New migration for schema change
3. `src/app/actions/goal-groups.ts` - Update CRUD functions
4. `src/app/actions/tile-completion.ts` - Update evaluation logic
5. `src/components/goal-tree-editor.tsx` - Add UI for configuration
6. `src/components/goal-progress-tree.tsx` - Update display logic
7. `src/components/compact-goal-tree.tsx` - Update display logic (if needed)

### Pattern Matching
- Follow existing schema patterns (integer with default value)
- Use existing server action patterns for updates
- Match UI patterns from existing group configuration
- Maintain backwards compatibility (default value of 1)

## Implementation Tasks

### Phase 1: Database Schema
- [ ] Add `minRequiredGoals` field to `goalGroups` table schema
  - Type: `integer`
  - Default: `1` (backwards compatible)
  - Not null
- [ ] Generate and review database migration
- [ ] Update TypeScript interfaces in goal-groups.ts to include new field

### Phase 2: Server Actions
- [ ] Update `createGoalGroup` to accept `minRequiredGoals` parameter
  - Add parameter with default value of 1
  - Include in insert values
- [ ] Update `updateGoalGroup` to support updating `minRequiredGoals`
  - Add to updates interface
  - Include in update logic
- [ ] Update `GoalGroup` interface to include `minRequiredGoals` field

### Phase 3: Completion Logic
- [ ] Update `evaluateGroup` function in tile-completion.ts
  - For OR groups: count completed children
  - Compare count to `group.minRequiredGoals`
  - Return true if count >= minRequiredGoals
- [ ] Ensure backwards compatibility with existing OR groups (default 1)

### Phase 4: UI - Goal Tree Editor
- [ ] Update group creation dialog
  - Add number input for "Minimum Required Goals"
  - Show only when OR operator is selected
  - Default value: 1
  - Validation: min 1, max should not exceed number of children
- [ ] Update group display/editing
  - Show current minRequiredGoals value for OR groups
  - Allow inline editing of the value
  - Update description text to reflect configured value
- [ ] Update `handleCreateGroup` to pass minRequiredGoals
- [ ] Add handler for updating minRequiredGoals

### Phase 5: UI - Progress Display
- [ ] Update `GoalProgressTree` component
  - Modify `evaluateGroup` to use `minRequiredGoals` from group data
  - Update display logic: show "X / minRequiredGoals" for OR groups
  - Update completion percentage calculation
- [ ] Update `CompactGoalTree` component (if it displays OR groups)
  - Similar changes to show proper completion requirements

### Phase 6: Testing & Validation
- [ ] Test creating new OR groups with different minRequiredGoals values
- [ ] Test updating existing OR groups to change minRequiredGoals
- [ ] Test completion evaluation with various scenarios:
  - OR group with minRequiredGoals = 1 (default)
  - OR group with minRequiredGoals = 3
  - Nested OR groups
  - Mixed AND/OR groups
- [ ] Test progress display shows correct values
- [ ] Test backwards compatibility with existing OR groups in database

## Validation Checklist
- [ ] All features implemented
- [ ] Database migration applied successfully
- [ ] No broken functionality for existing AND groups
- [ ] Backwards compatible with existing OR groups (default to 1)
- [ ] UI clearly shows minimum required goals for OR groups
- [ ] Completion evaluation respects minRequiredGoals setting
- [ ] Progress display accurately reflects completion status
- [ ] Build passes without errors
- [ ] No ESLint errors introduced

## Risk Mitigation
- **Potential Issues**:
  - Existing OR groups in database won't have minRequiredGoals field
  - UI validation needed to prevent invalid values (e.g., requiring 5 goals when only 3 exist)
  - Completion logic must handle edge cases (empty groups, all goals complete, etc.)

- **Rollback Strategy**:
  - Git commit after each phase
  - Database migration can be rolled back if needed
  - Default value of 1 ensures backwards compatibility

## Implementation Notes
- The feature will be opt-in: OR groups default to requiring 1 goal (current behavior)
- Users can configure higher values as needed (e.g., "complete 3 out of 5 optional goals")
- UI should provide helpful validation and feedback
- Consider adding helper text explaining the feature in the UI

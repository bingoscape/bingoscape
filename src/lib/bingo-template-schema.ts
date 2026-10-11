import { z } from "zod"

/**
 * Versioned schema for exported Boards (file export/import and Templates).
 *
 * Exports written by older versions are accepted: fields added later
 * (`bingoType`, goal groups, `goalType`, ...) fall back to the defaults the
 * app used before they existed. Everything is bounded so a hostile or
 * corrupted payload cannot exceed the database column limits.
 */

export const CURRENT_EXPORT_VERSION = "2.0"

const MAX_BOARD_SIZE = 10
const MAX_TILES = MAX_BOARD_SIZE * MAX_BOARD_SIZE
const MAX_GOALS_PER_TILE = 100
const MAX_GROUPS_PER_TILE = 100
const MAX_GOAL_VALUES_PER_GOAL = 100

const int32 = z.number().int().min(0).max(2_147_483_647)

const GoalGroupSchema = z.object({
  localId: z.string().max(100),
  parentLocalId: z.string().max(100).nullable().optional(),
  name: z.string().max(255).nullable().optional(),
  logicalOperator: z.enum(["AND", "OR", "SUM"]),
  minRequiredGoals: int32.default(1),
  orderIndex: int32.default(0),
})

const GoalValueSchema = z.object({
  value: z.number().int().min(-2_147_483_648).max(2_147_483_647),
  description: z.string().max(1000),
})

const ItemGoalSchema = z.object({
  itemId: z.number().int(),
  baseName: z.string().max(255),
  exactVariant: z.string().max(255).nullable().optional(),
  imageUrl: z.string().max(1000),
})

const MetricGoalSchema = z.object({
  metricType: z.string().max(100),
  metricName: z.string().max(100),
})

const GoalSchema = z.object({
  localId: z.string().max(100).optional(),
  parentLocalId: z.string().max(100).nullable().optional(),
  description: z.string().max(5000),
  targetValue: int32,
  goalType: z.enum(["generic", "item", "metric"]).default("generic"),
  orderIndex: int32.default(0),
  itemGoal: ItemGoalSchema.optional(),
  metricGoal: MetricGoalSchema.optional(),
  goalValues: z.array(GoalValueSchema).max(MAX_GOAL_VALUES_PER_GOAL).optional(),
})

const TileSchema = z
  .object({
    title: z.string().max(1000),
    description: z.string().max(10000),
    headerImage: z.string().max(255).nullable().optional(),
    weight: int32,
    index: int32,
    isHidden: z.boolean().default(true),
    tier: int32.default(0),
    goalGroups: z.array(GoalGroupSchema).max(MAX_GROUPS_PER_TILE).optional(),
    goals: z.array(GoalSchema).max(MAX_GOALS_PER_TILE).optional(),
  })
  .superRefine((tile, ctx) => {
    const groupIds = new Set(tile.goalGroups?.map((g) => g.localId))
    tile.goalGroups?.forEach((group, i) => {
      if (group.parentLocalId && !groupIds.has(group.parentLocalId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["goalGroups", i, "parentLocalId"],
          message: `Goal group references unknown parent "${group.parentLocalId}"`,
        })
      }
    })
    tile.goals?.forEach((goal, i) => {
      if (goal.parentLocalId && !groupIds.has(goal.parentLocalId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["goals", i, "parentLocalId"],
          message: `Goal references unknown group "${goal.parentLocalId}"`,
        })
      }
    })
  })

export const ExportedBingoSchema = z
  .object({
    version: z.string().max(20),
    metadata: z.object({
      title: z.string().min(1).max(255),
      description: z.string().max(10000).nullable().optional(),
      rows: z.number().int().min(1).max(MAX_BOARD_SIZE),
      columns: z.number().int().min(1).max(MAX_BOARD_SIZE),
      // Boards exported before this was added are standard boards.
      bingoType: z.enum(["standard", "progression"]).default("standard"),
      // Never trusted on import: a fresh codephrase is generated per Board.
      codephrase: z.string().max(255).optional(),
      tiersUnlockRequirement: int32.optional(),
      mainDiagonalBonusXP: int32.optional(),
      antiDiagonalBonusXP: int32.optional(),
      completeBoardBonusXP: int32.optional(),
    }),
    tiles: z.array(TileSchema).max(MAX_TILES),
    tierXpRequirements: z
      .array(z.object({ tier: int32, xpRequired: int32 }))
      .max(MAX_TILES)
      .optional(),
    rowBonuses: z
      .array(z.object({ rowIndex: int32, bonusXP: int32 }))
      .max(MAX_BOARD_SIZE)
      .optional(),
    columnBonuses: z
      .array(z.object({ columnIndex: int32, bonusXP: int32 }))
      .max(MAX_BOARD_SIZE)
      .optional(),
  })
  .superRefine((data, ctx) => {
    const { rows, columns } = data.metadata
    const capacity = rows * columns

    const seen = new Set<number>()
    data.tiles.forEach((tile, i) => {
      if (tile.index >= capacity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiles", i, "index"],
          message: `Tile index ${tile.index} is outside a ${rows}x${columns} board`,
        })
      }
      if (seen.has(tile.index)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiles", i, "index"],
          message: `Duplicate tile index ${tile.index}`,
        })
      }
      seen.add(tile.index)
    })

    data.rowBonuses?.forEach((bonus, i) => {
      if (bonus.rowIndex >= rows) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rowBonuses", i, "rowIndex"],
          message: `Row bonus index ${bonus.rowIndex} is outside the board`,
        })
      }
    })
    data.columnBonuses?.forEach((bonus, i) => {
      if (bonus.columnIndex >= columns) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["columnBonuses", i, "columnIndex"],
          message: `Column bonus index ${bonus.columnIndex} is outside the board`,
        })
      }
    })
  })

export type ExportedBingo = z.infer<typeof ExportedBingoSchema>

export type ParseExportedBingoResult =
  | { success: true; data: ExportedBingo }
  | { success: false; error: string }

/**
 * Parses and validates an exported Board. Accepts the raw JSON string or an
 * already-parsed value, and upgrades older export versions to the current
 * shape.
 */
export function parseExportedBingo(raw: unknown): ParseExportedBingoResult {
  let value = raw
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw)
    } catch {
      return { success: false, error: "Template data is not valid JSON" }
    }
  }

  const result = ExportedBingoSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : ""
    return {
      success: false,
      error: `Invalid import data format: ${issue?.message ?? "unknown error"}${where}`,
    }
  }

  return { success: true, data: result.data }
}

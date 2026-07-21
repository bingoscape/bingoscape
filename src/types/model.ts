import {
  bingos,
  tiles,
  goals,
  users,
  events,
  teams,
  clans,
  submissions,
  images,
  submissionComments,
  teamTileSubmissions,
  teamGoalProgress,
  goalValues,
  itemGoals,
  eventParticipants,
} from "@/server/db/schema"

// 1. Base Drizzle Types (Exact match to DB rows)
export type DbBingo = typeof bingos.$inferSelect
export type DbTile = typeof tiles.$inferSelect
export type DbGoal = typeof goals.$inferSelect
export type DbUser = typeof users.$inferSelect
export type DbEvent = typeof events.$inferSelect
export type DbTeam = typeof teams.$inferSelect
export type DbClan = typeof clans.$inferSelect
export type DbSubmission = typeof submissions.$inferSelect
export type DbImage = typeof images.$inferSelect
export type DbSubmissionComment = typeof submissionComments.$inferSelect
export type DbTeamTileSubmission = typeof teamTileSubmissions.$inferSelect
export type DbTeamProgress = typeof teamGoalProgress.$inferSelect
export type DbGoalValue = typeof goalValues.$inferSelect
export type DbItemGoal = typeof itemGoals.$inferSelect
export type DbEventParticipant = typeof eventParticipants.$inferSelect

// 2. Types with Relations for bingo.ts
export type GoalData = DbGoal

export type TileData = DbTile & {
  goals?: GoalData[]
}

export type BingoData = DbBingo & {
  tiles?: TileData[]
}

// 3. Types with Relations for events.ts
export type Image = DbImage

export type SubmissionComment = DbSubmissionComment & {
  author: Pick<DbUser, "id" | "name" | "runescapeName">
}

export type Submission = DbSubmission & {
  image: Image
  user: Pick<DbUser, "id" | "name" | "runescapeName">
  goal?: Goal | null
  comments?: SubmissionComment[]
}

export type Team = DbTeam
export type Clan = DbClan
export type EventParticipant = DbEventParticipant
export type TeamProgress = DbTeamProgress

export type TeamTileSubmission = DbTeamTileSubmission & {
  submissions: Submission[]
  team: Team
}

export type Goal = DbGoal & {
  goalValues?: DbGoalValue[]
  teamProgress?: TeamProgress[]
  itemGoal?: DbItemGoal | null
}

export type Tile = DbTile & {
  teamTileSubmissions?: TeamTileSubmission[]
  goals?: Goal[]
}

export type Bingo = DbBingo & {
  tiles?: Tile[]
}

export type Event = DbEvent & {
  bingos?: Bingo[]
  clan?: Clan | null
  teams?: Team[]
  eventParticipants?: EventParticipant[]
}

// 4. Custom / Projection Types
export type SelectableUser = Pick<DbUser, "id" | "name" | "runescapeName"> & {
  teamId?: string | null
  teamName?: string | null
}

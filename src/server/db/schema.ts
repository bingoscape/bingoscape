import { relations, sql } from "drizzle-orm"
import {
  AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTableCreator,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import type { AdapterAccount } from "next-auth/adapters"

export const createTable = pgTableCreator((name) => `bingoscape-next_${name}`)

export const users = createTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }).default(sql`CURRENT_TIMESTAMP`),
  image: varchar("image", { length: 255 }),
  runescapeName: varchar("runescapeName", { length: 255 }),
  // Username field for Credentials provider authentication
  // Nullable to support OAuth-only users (Discord, GitHub, Google)
  username: varchar("username", { length: 50 }),
  // Password field for Credentials provider authentication
  // Nullable to support OAuth-only users (Discord, GitHub, Google)
  password: varchar("password", { length: 255 }),
})

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  eventParticipants: many(eventParticipants),
  teamMembers: many(teamMembers),
  createdEvents: many(events),
  clanMemberships: many(clanMembers),
  // Add relation to submissions
  submissions: many(submissions),
  bingoTemplates: many(bingoTemplates), // Add this line
  apiKeys: many(apiKeys),
  registrationRequests: many(eventRegistrationRequests), // Add relation to registration requests
  playerMetadata: many(playerMetadata),
}))

export const accounts = createTable(
  "account",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_user_id_idx").on(account.userId),
  }),
)

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_user_id_idx").on(session.userId),
  }),
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
)

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "management"])
// Change the submissionStatusEnum to remove "declined" and use clearer names
export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved", // renamed from "accepted"
  "needs_review", // renamed from "requires_interaction"
])
export const clanRoleEnum = pgEnum("clan_role", ["admin", "management", "member", "guest"])
export const eventRoleEnum = pgEnum("event_role", ["admin", "management", "participant"])
export const registrationStatusEnum = pgEnum("registration_status", ["pending", "approved", "rejected"])
export const bingoTypeEnum = pgEnum("bingo_type", ["standard", "progression"])
export const logicalOperatorEnum = pgEnum("logical_operator", ["AND", "OR"])
export const goalTypeEnum = pgEnum("goal_type", ["generic", "item"])
export const skillLevelEnum = pgEnum("skill_level", ["beginner", "intermediate", "advanced", "expert", "pvmgod"])

export const playerMetadata = createTable(
  "player_metadata",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    ehp: real("ehp"), // Efficient Hours Played (nullable)
    ehb: real("ehb"), // Efficient Hours Bossed (nullable)
    combatLevel: integer("combat_level"), // OSRS combat level from WiseOldMan
    totalLevel: integer("total_level"), // Total skill level from WiseOldMan
    timezone: varchar("timezone", { length: 100 }), // e.g., "America/New_York", "Europe/London"
    dailyHoursAvailable: real("daily_hours_available"), // Planned daily participation time
    notes: text("notes"), // Management notes about the player
    womPlayerData: text("wom_player_data"), // JSON string of full WiseOldMan data (skills, bosses)
    lastFetchedFromWOM: timestamp("last_fetched_from_wom"), // Timestamp of last WOM fetch
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint: one metadata record per user per event
    userEventUnique: uniqueIndex("player_metadata_user_event_unique").on(
      table.userId,
      table.eventId,
    ),
  }),
)

export const playerMetadataRelations = relations(playerMetadata, ({ one }) => ({
  user: one(users, {
    fields: [playerMetadata.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [playerMetadata.eventId],
    references: [events.id],
  }),
}))

export const events = createTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  registrationDeadline: timestamp("registration_deadline"),
  creatorId: uuid("creator_id").references(() => users.id, { onDelete: "set null" }),
  clanId: uuid("clan_id").references(() => clans.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  locked: boolean("locked").default(false).notNull(),
  public: boolean("public").default(false).notNull(), // Renamed from 'visible' to 'public'
  basePrizePool: bigint("basePrizePool", { mode: "number" }).default(0).notNull(),
  minimumBuyIn: bigint("minimumBuyIn", { mode: "number" }).default(0).notNull(),
  requiresApproval: boolean("requires_approval").default(false).notNull(), // New field for registration approval
})

export const eventsRelations = relations(events, ({ many, one }) => ({
  bingos: many(bingos),
  eventParticipants: many(eventParticipants),
  creator: one(users, {
    fields: [events.creatorId],
    references: [users.id],
  }),
  teams: many(teams),
  clan: one(clans, { fields: [events.clanId], references: [clans.id] }),
  invites: many(eventInvites),
  registrationRequests: many(eventRegistrationRequests), // Add relation to registration requests
  discordWebhooks: many(discordWebhooks),
  playerMetadata: many(playerMetadata),
}))

// New table for event registration requests
export const eventRegistrationRequests = createTable("event_registration_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: registrationStatusEnum("status").default("pending").notNull(),
  message: text("message"), // Optional message from the user
  adminNotes: text("admin_notes"), // Optional notes from admin
  responseMessage: text("response_message"), // Optional response message to the user
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const eventRegistrationRequestsRelations = relations(eventRegistrationRequests, ({ one }) => ({
  event: one(events, {
    fields: [eventRegistrationRequests.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventRegistrationRequests.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [eventRegistrationRequests.reviewedBy],
    references: [users.id],
  }),
}))

export const bingos = createTable("bingos", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  rows: integer("rows").notNull(),
  columns: integer("columns").notNull(),
  codephrase: varchar("codephrase", { length: 255 }).notNull(),
  bingoType: bingoTypeEnum("bingo_type").default("standard").notNull(),
  tiersUnlockRequirement: integer("tiers_unlock_requirement").default(5).notNull(), // XP required to unlock next tier
  mainDiagonalBonusXP: integer("main_diagonal_bonus_xp").default(0).notNull(),
  antiDiagonalBonusXP: integer("anti_diagonal_bonus_xp").default(0).notNull(),
  completeBoardBonusXP: integer("complete_board_bonus_xp").default(0).notNull(), // Bonus XP for completing all tiles
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  locked: boolean("locked").default(false).notNull(),
  visible: boolean("visible").default(false).notNull(),
})

export const bingosRelations = relations(bingos, ({ one, many }) => ({
  event: one(events, {
    fields: [bingos.eventId],
    references: [events.id],
  }),
  tiles: many(tiles),
  tierProgress: many(teamTierProgress),
  tierXpRequirements: many(tierXpRequirements),
  rowBonuses: many(rowBonuses),
  columnBonuses: many(columnBonuses),
}))

export const teams = createTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const teamsRelations = relations(teams, ({ many, one }) => ({
  teamMembers: many(teamMembers),
  event: one(events, {
    fields: [teams.eventId],
    references: [events.id],
  }),
  goalProgress: many(teamGoalProgress),
  tierProgress: many(teamTierProgress),
}))

export const teamMembers = createTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isLeader: boolean("is_leader").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}))

export const tiles = createTable("tiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  bingoId: uuid("bingo_id")
    .notNull()
    .references(() => bingos.id, { onDelete: "cascade" }),
  headerImage: varchar("header_image", { length: 255 }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  weight: integer("weight").notNull(),
  index: integer("index").notNull(),
  isHidden: boolean("is_hidden").default(true).notNull(),
  tier: integer("tier").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const tilesRelations = relations(tiles, ({ one, many }) => ({
  bingo: one(bingos, {
    fields: [tiles.bingoId],
    references: [bingos.id],
  }),
  goals: many(goals),
  goalGroups: many(goalGroups),
  teamTileSubmissions: many(teamTileSubmissions),
}))

export const goalGroups = createTable("goal_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  tileId: uuid("tile_id")
    .notNull()
    .references(() => tiles.id, { onDelete: "cascade" }),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  parentGroupId: uuid("parent_group_id").references((): AnyPgColumn => goalGroups.id, { onDelete: "cascade" }),
  name: text("name"), // Optional custom name for the group
  logicalOperator: logicalOperatorEnum("logical_operator").notNull(),
  minRequiredGoals: integer("min_required_goals").notNull().default(1), // For OR groups: minimum number of goals that must be completed
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const goalGroupsRelations = relations(goalGroups, ({ one, many }) => ({
  tile: one(tiles, {
    fields: [goalGroups.tileId],
    references: [tiles.id],
  }),
  parentGroup: one(goalGroups, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    fields: [goalGroups.parentGroupId],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    references: [goalGroups.id],
    relationName: "groupHierarchy",
  }),
  childGroups: many(goalGroups, {
    relationName: "groupHierarchy",
  }),
  goals: many(goals),
}))

export const goals = createTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tileId: uuid("tile_id")
    .notNull()
    .references(() => tiles.id, { onDelete: "cascade" }),
  parentGroupId: uuid("parent_group_id").references(() => goalGroups.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  targetValue: integer("target_value").notNull(),
  goalType: goalTypeEnum("goal_type").notNull().default("generic"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const goalValues = createTable("goal_values", {
  id: uuid("id").defaultRandom().primaryKey(),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  value: real("value").notNull(), // Using real for float values
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const goalValuesRelations = relations(goalValues, ({ one }) => ({
  goal: one(goals, {
    fields: [goalValues.goalId],
    references: [goals.id],
  }),
}))

export const itemGoals = createTable("item_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  goalId: uuid("goal_id")
    .notNull()
    .unique()
    .references(() => goals.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull(),
  baseName: text("base_name").notNull(),
  exactVariant: text("exact_variant"),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const itemGoalsRelations = relations(itemGoals, ({ one }) => ({
  goal: one(goals, {
    fields: [itemGoals.goalId],
    references: [goals.id],
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const goalsRelations = relations(goals, ({ one, many }) => ({
  tile: one(tiles, {
    fields: [goals.tileId],
    references: [tiles.id],
  }),
  parentGroup: one(goalGroups, {
    fields: [goals.parentGroupId],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    references: [goalGroups.id],
  }),
  teamProgress: many(teamGoalProgress),
  goalValues: many(goalValues),
  itemGoal: one(itemGoals, {
    fields: [goals.id],
    references: [itemGoals.goalId],
  }),
}))

export const teamTileSubmissions = createTable(
  "team_tile_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tileId: uuid("tile_id")
      .notNull()
      .references(() => tiles.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    status: submissionStatusEnum("status").default("pending").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      tileTeamUnique: uniqueIndex("tile_team_unique").on(table.tileId, table.teamId),
    }
  },
)

export const teamTileSubmissionsRelations = relations(teamTileSubmissions, ({ one, many }) => ({
  tile: one(tiles, {
    fields: [teamTileSubmissions.tileId],
    references: [tiles.id],
  }),
  team: one(teams, {
    fields: [teamTileSubmissions.teamId],
    references: [teams.id],
  }),
  reviewer: one(users, {
    fields: [teamTileSubmissions.reviewedBy],
    references: [users.id],
  }),
  submissions: many(submissions),
}))

export const submissions = createTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamTileSubmissionId: uuid("team_tile_submission_id")
    .notNull()
    .references(() => teamTileSubmissions.id, { onDelete: "cascade" }),
  imageId: uuid("image_id")
    .notNull()
    .references(() => images.id, { onDelete: "cascade" }),
  // Add goalId to link submissions to specific goals
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  // Add userId to track which user submitted the image
  submittedBy: uuid("submitted_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Add submission value - can be from goalValues or custom
  submissionValue: real("submission_value").default(1.0).notNull(), // The actual value assigned to this submission
  // Add individual submission status
  status: submissionStatusEnum("status").default("pending").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  // Auto-submission metadata fields
  isAutoSubmission: boolean("is_auto_submission").default(false).notNull(),
  sourceNpcId: integer("source_npc_id"), // NPC ID that dropped the item (nullable)
  sourceName: varchar("source_name", { length: 255 }), // Name of source (NPC name, activity, etc.)
  sourceItemId: integer("source_item_id"), // Item ID that triggered the submission
  pluginAccountName: varchar("plugin_account_name", { length: 255 }), // Account name from plugin at time of submission
  sourceType: varchar("source_type", { length: 100 }), // Type of source: "NPC loot", "Pickpocket", "Event reward", etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const submissionComments = createTable("submission_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const submissionCommentsRelations = relations(submissionComments, ({ one }) => ({
  submission: one(submissions, {
    fields: [submissionComments.submissionId],
    references: [submissions.id],
  }),
  author: one(users, {
    fields: [submissionComments.authorId],
    references: [users.id],
  }),
}))

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  image: one(images, {
    fields: [submissions.imageId],
    references: [images.id],
  }),
  teamTileSubmission: one(teamTileSubmissions, {
    fields: [submissions.teamTileSubmissionId],
    references: [teamTileSubmissions.id],
  }),
  // Add relation to goal
  goal: one(goals, {
    fields: [submissions.goalId],
    references: [goals.id],
  }),
  // Add relation to user
  user: one(users, {
    fields: [submissions.submittedBy],
    references: [users.id],
  }),
  // Add relation to reviewer
  reviewer: one(users, {
    fields: [submissions.reviewedBy],
    references: [users.id],
  }),
  // Add relation to comments
  comments: many(submissionComments),
}))

export const eventParticipants = createTable("event_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: eventRoleEnum("role").default("participant").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const eventParticipantsRelations = relations(eventParticipants, ({ one, many }) => ({
  event: one(events, {
    fields: [eventParticipants.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventParticipants.userId],
    references: [users.id],
  }),
  buyIns: many(eventBuyIns),
  donations: many(eventDonations),
}))

export const clans = createTable("clans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ownerId: uuid("owner_id")
    // .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const clansRelations = relations(clans, ({ many }) => ({
  members: many(clanMembers),
  events: many(events),
  invites: many(clanInvites),
}))

export const clanMembers = createTable(
  "clan_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clanId: uuid("clan_id")
      .notNull()
      .references(() => clans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isMain: boolean("is_main").notNull().default(false),
    role: clanRoleEnum("role").default("guest").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      uniqUserMainClan: uniqueIndex("uniq_user_main_clan").on(table.userId),
    }
  },
)

export const clanMembersRelations = relations(clanMembers, ({ one }) => ({
  clan: one(clans, {
    fields: [clanMembers.clanId],
    references: [clans.id],
  }),
  user: one(users, {
    fields: [clanMembers.userId],
    references: [users.id],
  }),
}))

export const clanInvites = createTable("clan_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  clanId: uuid("clan_id")
    .notNull()
    .references(() => clans.id, { onDelete: "cascade" }),
  inviteCode: varchar("invite_code", { length: 10 }).notNull().unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const clanInvitesRelations = relations(clanInvites, ({ one }) => ({
  clan: one(clans, { fields: [clanInvites.clanId], references: [clans.id] }),
}))

export const eventInvites = createTable("event_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  inviteCode: varchar("invite_code", { length: 10 }).notNull().unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const eventInvitesRelations = relations(eventInvites, ({ one }) => ({
  event: one(events, { fields: [eventInvites.eventId], references: [events.id] }),
}))

export const images = createTable("images", {
  id: uuid("id").defaultRandom().primaryKey(),
  path: varchar("path", { length: 4096 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const imagesRelations = relations(images, ({ many }) => ({
  submissions: many(submissions),
}))

export const teamGoalProgress = createTable(
  "team_goal_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    currentValue: integer("current_value").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      goalTeamUnique: uniqueIndex("goal_team_unique").on(table.goalId, table.teamId),
    }
  },
)

export const teamGoalProgressRelations = relations(teamGoalProgress, ({ one }) => ({
  team: one(teams, {
    fields: [teamGoalProgress.teamId],
    references: [teams.id],
  }),
  goal: one(goals, {
    fields: [teamGoalProgress.goalId],
    references: [goals.id],
  }),
}))

export const teamTierProgress = createTable(
  "team_tier_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    bingoId: uuid("bingo_id")
      .notNull()
      .references(() => bingos.id, { onDelete: "cascade" }),
    tier: integer("tier").notNull(),
    isUnlocked: boolean("is_unlocked").default(false).notNull(),
    unlockedAt: timestamp("unlocked_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      teamBingoTierUnique: uniqueIndex("team_bingo_tier_unique").on(table.teamId, table.bingoId, table.tier),
    }
  },
)

export const teamTierProgressRelations = relations(teamTierProgress, ({ one }) => ({
  team: one(teams, {
    fields: [teamTierProgress.teamId],
    references: [teams.id],
  }),
  bingo: one(bingos, {
    fields: [teamTierProgress.bingoId],
    references: [bingos.id],
  }),
}))

export const tierXpRequirements = createTable(
  "tier_xp_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bingoId: uuid("bingo_id")
      .notNull()
      .references(() => bingos.id, { onDelete: "cascade" }),
    tier: integer("tier").notNull(),
    xpRequired: integer("xp_required").notNull().default(5), // XP required to unlock NEXT tier
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      bingoTierUnique: uniqueIndex("bingo_tier_unique").on(table.bingoId, table.tier),
    }
  },
)

export const tierXpRequirementsRelations = relations(tierXpRequirements, ({ one }) => ({
  bingo: one(bingos, {
    fields: [tierXpRequirements.bingoId],
    references: [bingos.id],
  }),
}))

export const rowBonuses = createTable(
  "row_bonuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bingoId: uuid("bingo_id")
      .notNull()
      .references(() => bingos.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(), // 0-based row number
    bonusXP: integer("bonus_xp").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      bingoRowUnique: uniqueIndex("bingo_row_unique").on(table.bingoId, table.rowIndex),
    }
  },
)

export const rowBonusesRelations = relations(rowBonuses, ({ one }) => ({
  bingo: one(bingos, {
    fields: [rowBonuses.bingoId],
    references: [bingos.id],
  }),
}))

export const columnBonuses = createTable(
  "column_bonuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bingoId: uuid("bingo_id")
      .notNull()
      .references(() => bingos.id, { onDelete: "cascade" }),
    columnIndex: integer("column_index").notNull(), // 0-based column number
    bonusXP: integer("bonus_xp").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      bingoColumnUnique: uniqueIndex("bingo_column_unique").on(table.bingoId, table.columnIndex),
    }
  },
)

export const columnBonusesRelations = relations(columnBonuses, ({ one }) => ({
  bingo: one(bingos, {
    fields: [columnBonuses.bingoId],
    references: [bingos.id],
  }),
}))

export const eventBuyIns = createTable("event_buy_ins", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventParticipantId: uuid("event_participant_id")
    .notNull()
    .references(() => eventParticipants.id, { onDelete: "cascade" }),
  amount: bigint("amount", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const eventBuyInsRelations = relations(eventBuyIns, ({ one }) => ({
  eventParticipant: one(eventParticipants, {
    fields: [eventBuyIns.eventParticipantId],
    references: [eventParticipants.id],
  }),
}))

export const eventDonations = createTable("event_donations", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventParticipantId: uuid("event_participant_id")
    .notNull()
    .references(() => eventParticipants.id, { onDelete: "cascade" }),
  amount: bigint("amount", { mode: "number" }).notNull(),
  description: text("description"), // Optional description for the donation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const eventDonationsRelations = relations(eventDonations, ({ one }) => ({
  eventParticipant: one(eventParticipants, {
    fields: [eventDonations.eventParticipantId],
    references: [eventParticipants.id],
  }),
}))

export const notifications = createTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  tileId: uuid("tile_id")
    .notNull()
    .references(() => tiles.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [notifications.eventId],
    references: [events.id],
  }),
  tile: one(tiles, {
    fields: [notifications.tileId],
    references: [tiles.id],
  }),
  team: one(teams, {
    fields: [notifications.teamId],
    references: [teams.id],
  }),
}))

// Add this to your existing schema.ts file
// This creates a new table for bingo templates

export const bingoTemplates = createTable("bingo_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  previewImage: varchar("preview_image", { length: 255 }),
  creatorId: uuid("creator_id")
    // .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  originalBingoId: uuid("original_bingo_id").references(() => bingos.id, { onDelete: "set null" }),
  category: varchar("category", { length: 100 }),
  tags: varchar("tags", { length: 255 }),
  isPublic: boolean("is_public").default(true).notNull(),
  templateData: text("template_data").notNull(), // Stores the exported JSON data
  downloadCount: integer("download_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const bingoTemplatesRelations = relations(bingoTemplates, ({ one }) => ({
  creator: one(users, {
    fields: [bingoTemplates.creatorId],
    references: [users.id],
  }),
  originalBingo: one(bingos, {
    fields: [bingoTemplates.originalBingoId],
    references: [bingos.id],
  }),
}))

// Add this to your existing schema.ts file
// This creates a new table for API keys

export const apiKeys = createTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  key: varchar("key", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsed: timestamp("last_used"),
})

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}))

export const discordWebhooks = createTable("discord_webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  webhookUrl: text("webhook_url").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const discordWebhooksRelations = relations(discordWebhooks, ({ one }) => ({
  event: one(events, {
    fields: [discordWebhooks.eventId],
    references: [events.id],
  }),
  creator: one(users, {
    fields: [discordWebhooks.createdBy],
    references: [users.id],
  }),
}))

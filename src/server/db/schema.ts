import { relations, sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTableCreator,
  primaryKey,
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
})

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  eventParticipants: many(eventParticipants),
  teamMembers: many(teamMembers),
  createdEvents: many(events),
  clanMemberships: many(clanMembers),
  // Add relation to submissions
  submissions: many(submissions),
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
export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "accepted",
  "requires_interaction",
  "declined",
])
export const clanRoleEnum = pgEnum("clan_role", ["admin", "management", "member", "guest"])
export const eventRoleEnum = pgEnum("event_role", ["admin", "management", "participant"])

export const events = createTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  clanId: uuid("clan_id").references(() => clans.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  locked: boolean("locked").default(false).notNull(),
  public: boolean("public").default(false).notNull(), // Renamed from 'visible' to 'public'
  basePrizePool: bigint("basePrizePool", { mode: "number" }).default(0).notNull(),
  minimumBuyIn: bigint("minimumBuyIn", { mode: "number" }).default(0).notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const tilesRelations = relations(tiles, ({ one, many }) => ({
  bingo: one(bingos, {
    fields: [tiles.bingoId],
    references: [bingos.id],
  }),
  goals: many(goals),
  teamTileSubmissions: many(teamTileSubmissions),
}))

export const goals = createTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tileId: uuid("tile_id")
    .notNull()
    .references(() => tiles.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  targetValue: integer("target_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const goalsRelations = relations(goals, ({ one, many }) => ({
  tile: one(tiles, {
    fields: [goals.tileId],
    references: [tiles.id],
  }),
  teamProgress: many(teamGoalProgress),
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
  // Add userId to track which user submitted the image
  submittedBy: uuid("submitted_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const submissionsRelations = relations(submissions, ({ one }) => ({
  image: one(images, {
    fields: [submissions.imageId],
    references: [images.id],
  }),
  teamTileSubmission: one(teamTileSubmissions, {
    fields: [submissions.teamTileSubmissionId],
    references: [teamTileSubmissions.id],
  }),
  // Add relation to user
  user: one(users, {
    fields: [submissions.submittedBy],
    references: [users.id],
  }),
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
}))

export const clans = createTable("clans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ownerId: uuid("owner_id")
    .notNull()
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


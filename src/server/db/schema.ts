import { relations, sql } from "drizzle-orm";
import {
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
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `bingoscape-next_${name}`);

export const users = createTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }).default(sql`CURRENT_TIMESTAMP`),
  image: varchar("image", { length: 255 }),
  runescapeName: varchar("runescapeName", { length: 255 })
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  eventParticipants: many(eventParticipants),
  teamMembers: many(teamMembers),
  createdEvents: many(events),
  clanMemberships: many(clanMembers),
}));

export const accounts = createTable(
  "account",
  {

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
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
  })
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_user_id_idx").on(session.userId),
  })
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

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
  })
);

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'management']);
export const submissionStatusEnum = pgEnum('submission_status', ['pending', 'accepted', 'requires_interaction', 'declined']);

export const clanRoleEnum = pgEnum('clan_role', ['admin', 'management', 'member', 'guest']);
export const eventRoleEnum = pgEnum('event_role', ['admin', 'management', 'participant']);

export const events = createTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  creatorId: uuid("creator_id").notNull().references(() => users.id),
  clanId: uuid("clan_id").references(() => clans.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  locked: boolean("locked").default(false).notNull(),
  visible: boolean("visible").default(false).notNull(),
});

export const eventsRelations = relations(events, ({ many, one }) => ({
  bingos: many(bingos),
  eventParticipants: many(eventParticipants),
  creator: one(users, {
    fields: [events.creatorId],
    references: [users.id],
  }),
  teams: many(teams),
  clan: one(clans, { fields: [events.clanId], references: [clans.id] }),
  invites: many(eventInvites)
}));

// Bingos table
export const bingos = createTable('bingos', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  rows: integer('rows').notNull(),
  columns: integer('columns').notNull(),
  codephrase: varchar('codephrase', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  locked: boolean("locked").default(false).notNull(),
  visible: boolean("visible").default(false).notNull(),
});

export const bingosRelations = relations(bingos, ({ one, many }) => ({
  event: one(events, {
    fields: [bingos.eventId],
    references: [events.id],
  }),
  tiles: many(tiles),
}));

// Teams table
export const teams = createTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const teamsRelations = relations(teams, ({ many, one }) => ({
  teamMembers: many(teamMembers),
  event: one(events, {
    fields: [teams.eventId],
    references: [events.id],
  }),
  goalProgress: many(teamGoalProgress),
}));

// Team Members table
export const teamMembers = createTable('team_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  isLeader: boolean('is_leader').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

// Tiles table
export const tiles = createTable('tiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  bingoId: uuid('bingo_id').notNull().references(() => bingos.id),
  headerImage: varchar('header_image', { length: 255 }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  weight: integer('weight').notNull(),
  index: integer('index').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tilesRelations = relations(tiles, ({ one, many }) => ({
  bingo: one(bingos, {
    fields: [tiles.bingoId],
    references: [bingos.id],
  }),
  goals: many(goals),
  //submissions: many(submissions),
  teamTileSubmissions: many(teamTileSubmissions)
}));

// Goals table
export const goals = createTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  tileId: uuid('tile_id').notNull().references(() => tiles.id),
  description: text('description').notNull(),
  targetValue: integer('target_value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Update goalsRelations
export const goalsRelations = relations(goals, ({ one, many }) => ({
  tile: one(tiles, {
    fields: [goals.tileId],
    references: [tiles.id],
  }),
  teamProgress: many(teamGoalProgress),
}));

export const teamTileSubmissions = createTable('team_tile_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tileId: uuid('tile_id').notNull().references(() => tiles.id),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  status: submissionStatusEnum('status').default('pending').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    tileTeamUnique: uniqueIndex('tile_team_unique').on(table.tileId, table.teamId),
  }
});

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
}));

export const submissions = createTable('submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamTileSubmissionId: uuid('team_tile_submission_id').notNull().references(() => teamTileSubmissions.id),
  imageId: uuid('image_id').notNull().references(() => images.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Event Participants table
export const eventParticipants = createTable('event_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: eventRoleEnum('role').default('participant').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const eventParticipantsRelations = relations(eventParticipants, ({ one }) => ({
  event: one(events, {
    fields: [eventParticipants.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventParticipants.userId],
    references: [users.id],
  }),
}));


export const clans = createTable("clans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clansRelations = relations(clans, ({ many }) => ({
  members: many(clanMembers),
  events: many(events),
  invites: many(clanInvites),
}));

export const clanMembers = createTable("clan_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  clanId: uuid("clan_id").notNull().references(() => clans.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  isMain: boolean("is_main").notNull().default(false),
  role: clanRoleEnum('role').default('guest').notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => {
  return {
    uniqUserMainClan: uniqueIndex("uniq_user_main_clan").on(table.userId),
  }
});

export const clanMembersRelations = relations(clanMembers, ({ one }) => ({
  clan: one(clans, {
    fields: [clanMembers.clanId],
    references: [clans.id],
  }),
  user: one(users, {
    fields: [clanMembers.userId],
    references: [users.id],
  }),
}));

export const clanInvites = createTable("clan_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  clanId: uuid("clan_id").notNull().references(() => clans.id),
  inviteCode: varchar("invite_code", { length: 10 }).notNull().unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clanInvitesRelations = relations(clanInvites, ({ one }) => ({
  clan: one(clans, { fields: [clanInvites.clanId], references: [clans.id] }),
}));

export const eventInvites = createTable("event_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  inviteCode: varchar("invite_code", { length: 10 }).notNull().unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eventInvitesRelations = relations(eventInvites, ({ one }) => ({
  event: one(events, { fields: [eventInvites.eventId], references: [events.id] }),
}));
//
// New Images table
export const images = createTable('images', {
  id: uuid('id').defaultRandom().primaryKey(),
  path: varchar('path', { length: 4096 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const imagesRelations = relations(images, ({ many }) => ({
  submissions: many(submissions),
}));

export const teamGoalProgress = createTable('team_goal_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  goalId: uuid('goal_id').notNull().references(() => goals.id),
  currentValue: integer('current_value').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const teamGoalProgressRelations = relations(teamGoalProgress, ({ one }) => ({
  team: one(teams, {
    fields: [teamGoalProgress.teamId],
    references: [teams.id],
  }),
  goal: one(goals, {
    fields: [teamGoalProgress.goalId],
    references: [goals.id],
  }),
}));

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgenum,
  pgtablecreator,
  primarykey,
  text,
  timestamp,
  uniqueindex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { type adapteraccount } from "next-auth/adapters";

export const createtable = pgtablecreator((name) => `bingoscape-next_${name}`);

export const users = createtable("user", {
  id: uuid("id").defaultrandom().primarykey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notnull(),
  emailverified: timestamp("email_verified", {
    mode: "date",
    withtimezone: true,
  }).default(sql`current_timestamp`),
  image: varchar("image", { length: 255 }),
  runescapename: varchar("runescapename", { length: 255 })
});

export const usersrelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  eventparticipants: many(eventparticipants),
  teammembers: many(teammembers),
  createdevents: many(events),
  clanmemberships: many(clanmembers),
}));

export const accounts = createtable(
  "account",
  {
    userid: uuid("user_id")
      .notnull()
      .references(() => users.id, { ondelete: "cascade" }),
    type: varchar("type", { length: 255 })
      .$type<adapteraccount["type"]>()
      .notnull(),
    provider: varchar("provider", { length: 255 }).notnull(),
    provideraccountid: varchar("provider_account_id", {
      length: 255,
    }).notnull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundkey: primarykey({
      columns: [account.provider, account.provideraccountid],
    }),
    userididx: index("account_user_id_idx").on(account.userid),
  })
);

export const accountsrelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userid], references: [users.id] }),
}));

export const sessions = createtable(
  "session",
  {
    sessiontoken: varchar("session_token", { length: 255 })
      .notnull()
      .primarykey(),
    userid: uuid("user_id")
      .notnull()
      .references(() => users.id, { ondelete: "cascade" }),
    expires: timestamp("expires", {
      mode: "date",
      withtimezone: true,
    }).notnull(),
  },
  (session) => ({
    userididx: index("session_user_id_idx").on(session.userid),
  })
);

export const sessionsrelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userid], references: [users.id] }),
}));

export const verificationtokens = createtable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notnull(),
    token: varchar("token", { length: 255 }).notnull(),
    expires: timestamp("expires", {
      mode: "date",
      withtimezone: true,
    }).notnull(),
  },
  (vt) => ({
    compoundkey: primarykey({ columns: [vt.identifier, vt.token] }),
  })
);

// enums
export const userroleenum = pgenum('user_role', ['user', 'admin', 'management']);
export const submissionstatusenum = pgenum('submission_status', ['pending', 'accepted', 'requires_interaction', 'declined']);
export const clanroleenum = pgenum('clan_role', ['admin', 'management', 'member', 'guest']);
export const eventroleenum = pgenum('event_role', ['admin', 'management', 'participant']);

export const events = createtable("events", {
  id: uuid("id").defaultrandom().primarykey(),
  title: varchar("name", { length: 255 }).notnull(),
  description: varchar("description", { length: 1000 }),
  startdate: timestamp("start_date").notnull(),
  enddate: timestamp("end_date").notnull(),
  creatorid: uuid("creator_id").notnull().references(() => users.id, { ondelete: "set null" }),
  clanid: uuid("clan_id").references(() => clans.id, { ondelete: "set null" }),
  createdat: timestamp("created_at").defaultnow().notnull(),
  updatedat: timestamp("updated_at").defaultnow().notnull(),
  locked: boolean("locked").default(false).notnull(),
  visible: boolean("visible").default(false).notnull(),
  baseprizepool: bigint('baseprizepool', { mode: 'number' }).default(0).notnull(),
  minimumbuyin: bigint("minimumbuyin", { mode: 'number' }).default(0).notnull()
});

export const eventsrelations = relations(events, ({ many, one }) => ({
  bingos: many(bingos),
  eventparticipants: many(eventparticipants),
  creator: one(users, {
    fields: [events.creatorid],
    references: [users.id],
  }),
  teams: many(teams),
  clan: one(clans, { fields: [events.clanid], references: [clans.id] }),
  invites: many(eventinvites),
  buyins: many(eventbuyins)
}));

export const bingos = createtable('bingos', {
  id: uuid('id').defaultrandom().primarykey(),
  eventid: uuid('event_id').notnull().references(() => events.id, { ondelete: "cascade" }),
  title: varchar('title', { length: 255 }).notnull(),
  description: text('description'),
  rows: integer('rows').notnull(),
  columns: integer('columns').notnull(),
  codephrase: varchar('codephrase', { length: 255 }).notnull(),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
  locked: boolean("locked").default(false).notnull(),
  visible: boolean("visible").default(false).notnull(),
});

export const bingosrelations = relations(bingos, ({ one, many }) => ({
  event: one(events, {
    fields: [bingos.eventid],
    references: [events.id],
  }),
  tiles: many(tiles),
}));

export const teams = createtable('teams', {
  id: uuid('id').defaultrandom().primarykey(),
  eventid: uuid('event_id').notnull().references(() => events.id, { ondelete: "cascade" }),
  name: varchar('name', { length: 255 }).notnull(),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
});

export const teamsrelations = relations(teams, ({ many, one }) => ({
  teammembers: many(teammembers),
  event: one(events, {
    fields: [teams.eventid],
    references: [events.id],
  }),
  goalprogress: many(teamgoalprogress),
}));

export const teammembers = createtable('team_members', {
  id: uuid('id').defaultrandom().primarykey(),
  teamid: uuid('team_id').notnull().references(() => teams.id, { ondelete: "cascade" }),
  userid: uuid('user_id').notnull().references(() => users.id, { ondelete: "cascade" }),
  isleader: boolean('is_leader').default(false).notnull(),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
});

export const teammembersrelations = relations(teammembers, ({ one }) => ({
  team: one(teams, {
    fields: [teammembers.teamid],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teammembers.userid],
    references: [users.id],
  }),
}));

export const tiles = createtable('tiles', {
  id: uuid('id').defaultrandom().primarykey(),
  bingoid: uuid('bingo_id').notnull().references(() => bingos.id, { ondelete: "cascade" }),
  headerimage: varchar('header_image', { length: 255 }),
  title: text('title').notnull(),
  description: text('description').notnull(),
  weight: integer('weight').notnull(),
  index: integer('index').notnull(),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
});

export const tilesrelations = relations(tiles, ({ one, many }) => ({
  bingo: one(bingos, {
    fields: [tiles.bingoid],
    references: [bingos.id],
  }),
  goals: many(goals),
  teamtilesubmissions: many(teamtilesubmissions)
}));

export const goals = createtable('goals', {
  id: uuid('id').defaultrandom().primarykey(),
  tileid: uuid('tile_id').notnull().references(() => tiles.id, { ondelete: "cascade" }),
  description: text('description').notnull(),
  targetvalue: integer('target_value').notnull(),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
});

export const goalsrelations = relations(goals, ({ one, many }) => ({
  tile: one(tiles, {
    fields: [goals.tileid],
    references: [tiles.id],
  }),
  teamprogress: many(teamgoalprogress),
}));

export const teamtilesubmissions = createtable('team_tile_submissions', {
  id: uuid('id').defaultrandom().primarykey(),
  tileid: uuid('tile_id').notnull().references(() => tiles.id, { ondelete: "cascade" }),
  teamid: uuid('team_id').notnull().references(() => teams.id, { ondelete: "cascade" }),
  status: submissionstatusenum('status').default('pending').notnull(),
  reviewedby: uuid('reviewed_by').references(() => users.id, { ondelete: "set null" }),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
}, (table) => {
  return {
    tileteamunique: uniqueindex('tile_team_unique').on(table.tileid, table.teamid),
  }
});

export const teamtilesubmissionsrelations = relations(teamtilesubmissions, ({ one, many }) => ({
  tile: one(tiles, {
    fields: [teamtilesubmissions.tileid],
    references: [tiles.id],
  }),
  team: one(teams, {
    fields: [teamtilesubmissions.teamid],
    references: [teams.id],
  }),
  reviewer: one(users, {
    fields: [teamtilesubmissions.reviewedby],
    references: [users.id],
  }),
  submissions: many(submissions),
}));

export const submissions = createtable('submissions', {
  id: uuid('id').defaultrandom().primarykey(),
  teamtilesubmissionid: uuid('team_tile_submission_id').notnull().references(() => teamtilesubmissions.id, { ondelete: "cascade" }),
  imageid: uuid('image_id').notnull().references(() => images.id, { ondelete: "cascade" }),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
});

export const submissionsrelations = relations(submissions, ({ one }) => ({
  image: one(images, {
    fields: [submissions.imageid],
    references: [images.id]
  }),
  teamtilesubmission: one(teamtilesubmissions, {
    fields: [submissions.teamtilesubmissionid],
    references: [teamtilesubmissions.id]
  })
}));

export const eventparticipants = createtable('event_participants', {
  id: uuid('id').defaultrandom().primarykey(),
  eventid: uuid('event_id').notnull().references(() => events.id, { ondelete: "cascade" }),
  userid: uuid('user_id').notnull().references(() => users.id, { ondelete: "cascade" }),
  role: eventroleenum('role').default('participant').notnull(),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
});

export const eventparticipantsrelations = relations(eventparticipants, ({ one }) => ({
  event: one(events, {
    fields: [eventparticipants.eventid],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventparticipants.userid],
    references: [users.id],
  }),
}));

export const clans = createtable("clans", {
  id: uuid("id").defaultrandom().primarykey(),
  name: varchar("name", { length: 255 }).notnull(),
  description: varchar("description", { length: 1000 }),
  ownerid: uuid("owner_id").notnull().references(() => users.id, { ondelete: "set null" }),
  createdat: timestamp("created_at").defaultnow().notnull(),
  updatedat: timestamp("updated_at").defaultnow().notnull(),
});

export const clansrelations = relations(clans, ({ many }) => ({
  members: many(clanmembers),
  events: many(events),
  invites: many(claninvites),
}));

export const clanmembers = createtable("clan_members", {
  id: uuid("id").defaultrandom().primarykey(),
  clanid: uuid("clan_id").notnull().references(() => clans.id, { ondelete: "cascade" }),
  userid: uuid("user_id").notnull().references(() => users.id, { ondelete: "cascade" }),
  ismain: boolean("is_main").notnull().default(false),
  role: clanroleenum('role').default('guest').notnull(),
  joinedat: timestamp("joined_at").defaultnow().notnull(),
}, (table) => {
  return {
    uniqusermainclan: uniqueindex("uniq_user_main_clan").on(table.userid),
  }
});

export const clanmembersrelations = relations(clanmembers, ({ one }) => ({
  clan: one(clans, {
    fields: [clanmembers.clanid],
    references: [clans.id],
  }),
  user: one(users, {
    fields: [clanmembers.userid],
    references: [users.id],
  }),
}));

export const claninvites = createtable("clan_invites", {
  id: uuid("id").defaultrandom().primarykey(),
  clanid: uuid("clan_id").notnull().references(() => clans.id, { ondelete: "cascade" }),
  invitecode: varchar("invite_code", { length: 10 }).notnull().unique(),
  expiresat: timestamp("expires_at"),
  createdat: timestamp("created_at").defaultnow().notnull(),
});

export const claninvitesrelations = relations(claninvites, ({ one }) => ({
  clan: one(clans, { fields: [claninvites.clanid], references: [clans.id] }),
}));

export const eventinvites = createtable("event_invites", {
  id: uuid("id").defaultrandom().primarykey(),
  eventid: uuid("event_id").notnull().references(() => events.id, { ondelete: "cascade" }),
  invitecode: varchar("invite_code", { length: 10 }).notnull().unique(),
  expiresat: timestamp("expires_at"),
  createdat: timestamp("created_at").defaultnow().notnull(),
});

export const eventinvitesrelations = relations(eventinvites, ({ one }) => ({
  event: one(events, { fields: [eventinvites.eventid], references: [events.id] }),
}));

export const images = createtable('images', {
  id: uuid('id').defaultrandom().primarykey(),
  path: varchar('path', { length: 4096 }).notnull(),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
});

export const imagesrelations = relations(images, ({ many }) => ({
  submissions: many(submissions),
}));

export const teamgoalprogress = createtable('team_goal_progress', {
  id: uuid('id').defaultrandom().primarykey(),
  teamid: uuid('team_id').notnull().references(() => teams.id, { ondelete: "cascade" }),
  goalid: uuid('goal_id').notnull().references(() => goals.id, { ondelete: "cascade" }),
  currentvalue: integer('current_value').notnull().default(0),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
});

export const teamgoalprogressrelations = relations(teamgoalprogress, ({ one }) => ({
  team: one(teams, {
    fields: [teamgoalprogress.teamid],
    references: [teams.id],
  }),
  goal: one(goals, {
    fields: [teamgoalprogress.goalid],
    references: [goals.id],
  }),
}));

export const eventbuyins = createtable('event_buy_ins', {
  id: uuid('id').defaultrandom().primarykey(),
  eventid: uuid('event_id').notnull().references(() => events.id, { ondelete: "cascade" }),
  userid: uuid('user_id').notnull().references(() => users.id, { ondelete: "cascade" }),
  amount: bigint('amount', { mode: 'number' }).notnull(),
  createdat: timestamp('created_at').defaultnow().notnull(),
  updatedat: timestamp('updated_at').defaultnow().notnull(),
}, (table) => {
  return {
    eventuseridx: uniqueindex('event_user_idx').on(table.eventid, table.userid),
  }
});

export const eventbuyinsrelations = relations(eventbuyins, ({ one }) => ({
  event: one(events, {
    fields: [eventbuyins.eventid],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventbuyins.userid],
    references: [users.id],
  }),
}));

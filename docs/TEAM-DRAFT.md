# Team draft

Captains take turns picking players from the Event's participants into teams, live, with everybody watching. It is an alternative to filling teams by hand (`team-management.tsx`) or generating them (`auto-team-generator-modal.tsx`). Epic #214; phases #215 to #218.

There is no feature flag: the draft is available in every Event. An Event only shows it once a manager sets one up.

- [For organizers](#for-organizers)
- [For members and spectators](#for-members-and-spectators)
- [Roles and permissions](#roles-and-permissions)
- [Timeout modes](#timeout-modes)
- [Discord](#discord)
- [Architecture (for developers)](#architecture-for-developers)
- [Operations: SSE, nginx, sweeper](#operations-sse-nginx-sweeper)
- [Troubleshooting](#troubleshooting)

## For organizers

### Before you start

- Everyone who should be draftable has to be a participant of the Event and **not on a team yet**. Existing teams are left alone; their members are not in the pool.
- Wise Old Man data (EHP, EHB, daily hours, time zone) in the Event's player metadata makes the ratings and the balance panel meaningful. Players without data are shown as "Unrated" and are never rated by guess.
- Optional: add a Discord webhook to the Event (Quick Actions, "Discord Webhooks") to get every pick posted, see [Discord](#discord).

### Set up

Event header, "Set up draft" (or Quick Actions, "Set Up Team Draft"), `/events/<id>/draft/setup`:

| Setting | Meaning |
| ------- | ------- |
| Order | `linear` (same order every round), `snake` (the order reverses every round) or `random snake` (a random starting order, drawn when the draft starts, then a snake). |
| Rounds | Picks per captain. A draft that runs all its rounds makes `rounds x teams` picks. |
| Team size cap | Optional. Captain included. A team that reached it is passed over. Default: captain plus one player per round. |
| Pick timer | Seconds per pick; empty or 0 means no timer. |
| When the timer runs out | `auto_pick` (default), `skip` or `pause`, see [Timeout modes](#timeout-modes). |
| Auto-pick rule | `best_rated` (default) or `random`: who the timer picks when the captain's queue is empty. |
| Captains | At least two, chosen from the participants without a team, in setup order. |

The form previews the pool size, the number of rounds and how many players are left over. Creating the draft only stores the settings; nothing else changes yet.

### Run it

"Start draft" creates one team per captain (the captain is its leader), freezes the pool (every participant without a team, minus the captains), snapshots each player's rating and draws the order. From then on captains pick in turn in the draft room, `/events/<id>/draft`.

Manager controls, all in the room:

- **Pause / Resume.** A pause freezes the time left on the turn; resume restores it.
- **Skip turn.** The captain on the clock loses the pick and the next team is up. Teams may end up uneven.
- **Pick for team.** Pick button of the pool while it is somebody else's turn: you pick for the on-turn captain (shown as "forced").
- **Undo last pick.** Takes the last pick back (the player returns to the pool, the pick returns to the captain, the timer restarts). It also reopens a complete draft that was not applied yet. The undone pick stays in the audit trail.
- **Cancel draft.** Deletes the teams the draft created, as long as they hold nothing but their captain and have no progress; a team with more is kept. Not possible after the teams were applied.
- **Apply teams.** Available when the draft is complete. Writes the drafted players to their teams. Players who left the Event since the pool was frozen are reported, not fatal; a player who joined a team elsewhere in the meantime makes the apply refuse as a whole. Players nobody picked stay unassigned (listed for you under "Unassigned"). Applying cannot be undone from the draft.

The room warns you when a captain let the timer run out twice in a row ("Away") and when a drafted player has left the Event.

### Afterwards

When the last pick is made the room offers the **recap**, `/events/<id>/draft/recap` (Quick Actions, "Team Draft Recap"), for every member:

- final rosters, with "Applied" or "Not applied yet",
- **Share as image**: a PNG of the final rosters to download or copy, for pasting into Discord,
- the pick history table.

As a manager you also get **analytics** on that page:

- **Reach and steal picks.** Each rated pick is compared with the player's rank by rating among the rated pool. `delta = pick number - rating rank`. A pick a full round or more (the number of teams, at least 2) earlier than the rank is a *reach*, one that late a *steal*. Unrated picks have no rank.
- **Time per pick**, from the draft log: from the event that started the turn (start, the previous pick or skip, a resume, an undo) to the pick. Picks made by the timer are left out, they only measure the timer.
- **Auto-pick rate**, turns lost to the timer and picks you forced.
- **Balance gap to the optimiser.** The team balancing objective (variance of the team averages of EHP, EHB, daily hours and skill level, plus the time zone spread; lower is better) for the drafted teams, against the best assignment simulated annealing finds over the same players into the same number of teams. A yardstick, not a target: the optimiser ignores captains and draft rules.

## For members and spectators

Every member of the Event can open the room and watch, nothing is public (signed-out visitors and non-members get 404 / 403). Picks appear live; the badge next to the title shows `Live`, `Reconnecting` or `Polling`.

- **"You"**: your own row in the pool, on a roster and on the recap is marked.
- **Ratings** are visible to all members (the rating out of 100, from the team balancing score); players without Wise Old Man data show "Unrated".
- **Balance panel**, computed over the picks so far: per team the size, the sum and mean of the drafted players' ratings, how many of the pool's top players it has (the best two per team), and the time zones (UTC offsets) it covers; above it the standard deviation and spread of the sums and means across teams. Captains are not rated, so they are left out of the rating figures. Members receive only each player's current UTC offset (whole hours), never the name of their time zone.
- Captains additionally get the pick controls, a private pick queue (the players the timer takes first for them), turn cues (toast, tab title, optional sound and browser notification) and keyboard picking.

## Roles and permissions

| Permission | Who | What |
| ---------- | --- | ---- |
| `draft:view` | Every Event member | Open the room, the state and stream endpoints, the recap and the image. |
| `draft:pick` | The leader of the on-turn team only | Pick. Whose turn it is is only known under the draft row lock, so the server checks it there. |
| `draft:manage` | Managers (admin and management roles) | Set up, start, pause, resume, skip, force a pick, undo, apply, cancel; analytics. |

There is no new Event role: a captain is a participant with `team_members.is_leader = true`. Every server action and route is registered in `src/server/authz/registry.ts`.

## Timeout modes

Per draft, set at setup. The timer is optional (0 = off). The deadline is the **database clock** (`clock_timestamp()`); nothing the client sends moves it, and a pick that arrives after the deadline loses to the timer.

| `on_timeout` | What happens when a captain's time is up |
| ------------ | ---------------------------------------- |
| `auto_pick` (default) | The first still-available player of the captain's queue, else the best-rated (`best_rated`) or a random (`random`) available player. The pick is marked `auto`. |
| `skip` | The captain loses the pick; the next turn starts with a fresh deadline. |
| `pause` | The draft pauses until a manager resumes it; the turn then starts with the full time. |

A captain who lets the timer run out twice in a row is flagged "Away" to the managers.

## Discord

Every active webhook of the Event (the same ones used for submissions) gets a message for:

- the **start** (teams in pick order, pool size, rounds, order, timer),
- **each pick** (player, team, round, rating or "Unrated", and whether the captain, the timer or an organizer picked),
- an **undo** ("Pick #3 undone"),
- the **completion** (final rosters),
- the **applied teams** (final rosters).

Messages are sent **after the transaction that wrote the change has committed**, never inside it, so a slow or failing webhook cannot block, delay or roll back a pick. Errors are logged and swallowed. See [Architecture](#discord-posting).

## Architecture (for developers)

### Data

Migrations `0041` (schema), `0042` (timer, undo, queue) and `0043` (Discord cursor) are add-first and compatible with the previous app version, see `docs/DATABASE-MIGRATION.md`. Ids are `uuid` (`createTable`, like the rest of `schema.ts`).

| Table | Purpose |
| ----- | ------- |
| `draft` | One non-cancelled draft per Event (partial unique index): status, order, rounds, timer settings, `current_pick_no`, `turn_deadline`, `paused_remaining_ms`, `version`, `seed`, `discord_posted_seq`. |
| `draft_team_slot` | A captain's place in the order, the Team (set at start), `consecutive_timeouts`. |
| `draft_pool_entry` | A frozen pool player with the rating snapshot (`rating_source = team_balancing_v1`). |
| `draft_pick` | A pick. Unique `(draft_id, pick_no)` and `(draft_id, pool_entry_id)` among non-undone picks; undo sets `undone_at` (soft delete). |
| `draft_queue_entry` | A captain's private pick queue. |
| `draft_event` | Append-only log with an identity `seq`, written in the same transaction as the change. `actor_user_id` has no foreign key, so it can be anonymised. |

State tables plus the log in the same transaction are the source of truth. The log drives reconnect catch-up (`Last-Event-ID`), the client reducer, the analytics and the Discord poster.

### Code map

| Path | What |
| ---- | ---- |
| `src/app/actions/draft.ts` | Thin server actions (`eventAction`: parse, authorize, one transaction). |
| `src/server/draft/core.ts` | The lifecycle as plain functions in the caller's transaction (create, start, pause, resume, pick, skip, undo, apply, cancel). |
| `src/server/draft/turn.ts`, `expire.ts` | Turn advance and the timer: lazy expiry under the row lock, the once-per-second sweeper (`pg_try_advisory_xact_lock`). |
| `src/server/draft/internal.ts` | Row lock, log append (`pg_notify` in the same transaction), guarded updates, timer SQL. |
| `src/server/draft/queries.ts` | Snapshot, deltas, players. No authorization; callers check `draft:view`. |
| `src/server/draft/hub.ts`, `stream.ts` | One `LISTEN draft_events` connection per process; the SSE stream. |
| `src/server/draft/discord.ts` | The Discord poster. |
| `src/server/draft/analytics.ts` | Loads the data for the manager analytics. |
| `src/server/draft/retention.ts` | Log retention and anonymisation. |
| `src/lib/draft/*` | Pure logic shared with the client: order, rating, reducer, timer, `balance.ts`, `analytics.ts`, `optimum.ts`. |
| `src/lib/team-balancing/scoring.ts`, `annealing.ts` | The scoring and simulated annealing of team balancing, in plain modules (a `"use server"` file may only export async functions). |
| `src/server/authz/team-membership.ts` | The only writer of `team_members` for the draft (teams at start, players at apply). |
| `src/components/draft/*` | The room, setup form, recap (`recap/`), balance panel. |

### Race safety

Every mutation first locks the draft row (`SELECT ... FOR UPDATE`), checks its rules against rows read under that lock, writes the change and appends a log event in the same transaction. Status changes are `UPDATE ... WHERE status = <expected>` with the affected rows counted. The unique indexes are the backstop, not the guard. A function that can write before it refuses runs its writes in a savepoint (`atomic`).

### Live updates

`appendDraftEvent` issues `pg_notify('draft_events', {draftId, seq})` in the transaction; Postgres delivers it only on commit. The hub wakes the open streams of that draft, which read the log after the last `seq` they sent. A client too far behind gets a `reset` snapshot. The client (`use-draft-stream`) feeds the shared reducer, drops duplicates, refetches on a gap and falls back to ETag polling of `GET /api/events/<id>/draft/state` when the stream is blocked. Streams end after about 5 minutes and on `SIGTERM`, so the client reconnects and is authorized again.

### Discord posting

`appendDraftEvent` only writes rows. After the transaction committed, the code that ran it calls `flushDraftDiscord(draftId)`:

- the server actions (`finish` in `src/app/actions/draft.ts`, only after the action body ran, so the caller was authorized),
- the sweeper (`sweepExpiredDrafts`, after its outer transaction committed),
- the lazy expiry of a state read (`settleExpiredDraft`).

The flush runs on after the response (`void`) and never throws. It claims the unposted events under the draft row lock and advances `draft.discord_posted_seq` in the same short transaction, so two flushes (a pick and the sweeper, two instances) never post the same event twice; a crash between the claim and the HTTP call loses that post, which is fine for a notification. It posts `started`, `pick`, `undo`, `completed` and `applied`, one message per event, in order, via `sendDiscordWebhook` (`src/lib/discord-webhook.ts`, which only ever posts to Discord hosts). Because the cursor moves past events even without a webhook, adding a webhook later does not replay history.

### Audit and retention

- `event_audit_log` gets one row per manager action: `draft.start`, `draft.pause`, `draft.resume`, `draft.skip_turn`, `draft.force_pick`, `draft.undo`, `draft.apply` and `draft.cancel` (permission `draft:manage`, target the draft), written in the transaction of the change. A refused action writes nothing. Applying also writes the existing `team.members.add` rows per team.
- Draft logs follow `EVENT_AUDIT_RETENTION_DAYS` (365). `purgeExpiredDraftLogs` (run by the sweeper at boot and every 6 hours) deletes the log of drafts that are cancelled or applied and were last touched before the cutoff, except the `started` event, which carries the pick order the room needs. Live and complete-but-unapplied drafts are never purged. The rosters live in `draft_pick` and are not touched.
- Erasure of a user: `anonymiseDraftActor(userId)` sets `draft_event.actor_user_id` to NULL and keeps the rows. `event_audit_log` is anonymised the same way (see `src/server/authz/audit-log.ts`). Pick and captain references to the user are `ON DELETE SET NULL`. The user id inside event payloads (the picked player) is part of the draft record and stays.

## Operations: SSE, nginx, sweeper

The stream, the `LISTEN` connection and the sweeper need a long-lived Node process (true for the Docker deployment, not for serverless).

- **nginx.** A dedicated unbuffered location for `/api/events/<id>/draft/stream` above `location /`, with `proxy_buffering off` and a long `proxy_read_timeout`. The exact block and a `curl -N` check are in `docs/PRODUCTION-SETUP.md`, "Live team draft".
- **Database connections.** One extra permanent connection per app process for `LISTEN`. It does not work through PgBouncer in transaction pooling mode: point `DATABASE_URL` at Postgres directly (or a session-mode pooler).
- **Sweeper.** Starts from `src/instrumentation.ts` (not during `next build`), once per second and right at boot, so a turn that expired during a deploy is resolved as soon as the new container is up. Expired turns are also resolved lazily on every pick, state read and stream connect. `GET /api/cron/draft-sweep` (bearer `CRON_SECRET`) runs the same sweep as an optional host-cron backstop.
- **Deploys.** Streams are closed with `bye` on `SIGTERM`; clients resume from `Last-Event-ID`. Migrations run before the new app starts and a rollback does not revert them, which is why `0041` to `0043` only add.

## Troubleshooting

| Symptom | Likely cause and what to do |
| ------- | --------------------------- |
| The badge says "Polling" instead of "Live". | The stream is blocked or buffered. Check the nginx location (`sudo nginx -T \| grep -n draft/stream`) and run the `curl -N` check from `docs/PRODUCTION-SETUP.md`. Polling works, picks arrive within about 3 s. |
| The badge keeps flipping to "Reconnecting". | Something closes idle connections (proxy timeout shorter than the 15 s heartbeat) or the app restarts. Check `proxy_read_timeout` and the app logs for `Draft LISTEN connection`. |
| Picks only show after a reload. | `LISTEN` is not working: `DATABASE_URL` goes through a transaction-mode pooler. Use a direct or session-mode connection. |
| "Too many open draft streams" (429). | A user holds more than 3 streams (tabs, phone). Close some; streams also end by themselves after about 5 minutes. |
| The timer ran out and nothing happened. | The sweeper is not running (serverless, or `next build` environment). The turn is settled the next time anybody opens the room or picks; call `GET /api/cron/draft-sweep` from host cron as a backstop. |
| A captain cannot pick. | It is not their turn, the draft is paused, or they are not the leader of the on-turn team. Managers can pick for them with "Pick for team". |
| Nothing arrives in Discord. | The Event has no active webhook, the URL is not a Discord webhook URL (anything else is refused), or Discord rejected the post: look for `Discord webhook failed` in the app logs. A failed post is never retried, and never affects the draft. |
| Discord got the pick twice or not at all. | Posts are claimed under the row lock and move `draft.discord_posted_seq`; a double post should not be possible. If one was lost the app crashed between the claim and the HTTP call. |
| "Apply teams" refuses. | A drafted player joined another team in the meantime; resolve that (remove them from the other team or undo the pick) and apply again. |
| A player drafted earlier left the Event. | They are tagged "Left event" and are reported by the apply instead of failing it; place a replacement by hand. |
| The analytics page has no balance gap. | The drafted teams are too uneven in size for the optimiser's objective (it refuses a team size variance beyond a quarter of the mean size squared). |
| A draft is stuck `in_progress` after rolling the app back. | The previous version cannot move it. Cancel it from the new version, or delete the teams by hand (see `docs/DATABASE-MIGRATION.md`, "Team draft rollout"). |

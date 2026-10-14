# 0001: Read visibility defaults (RBAC epic #183, decisions 3-5)

Status: **default pending maintainer confirmation.** Each default below is what
the application did before the read policy (#187) existed. Nothing here is a
decision yet; the point of this record is that changing one is a one-line edit.

## Context

Reads were decided by each query for itself: `getEventById` loaded the whole
Event for anybody, `getMiniBoardTiles`, `getBingoById` and the Goal readers
answered any caller who had a Board or Tile id, the statistics had no check at
all, and `/api/uploads` served every file. The Event page itself only shows
members a Board; everybody else sees the join card.

## The policy

`src/lib/authz/read-policy.ts` (pure) and `src/server/authz/read.ts` (session
and database) answer one question per read: how does the viewer stand towards
the Event?

| Level     | Who                                                                    |
| --------- | ---------------------------------------------------------------------- |
| `manager` | admin, management, the creator (hidden / Blind Tiles, drafts, secrets) |
| `member`  | any other participant, or a member of one of its Teams                 |
| `public`  | not a member, the Event is public (also anonymous)                     |
| `summary` | signed in, not a member, the Event is not public: holds the link       |
| `none`    | everybody else                                                         |

and what each level may read:

| Scope         | Data                                                            | manager | member | public | summary |
| ------------- | --------------------------------------------------------------- | :-----: | :----: | :----: | :-----: |
| `summary`     | the join card: title, dates, registration                       |   yes   |  yes   |  yes   |   yes   |
| `content`     | visible Boards, Tiles, Goals, leaderboard, Teams, prize pool    |   yes   |  yes   |  yes   |   no    |
| `member-data` | per player and Submission data: statistics, Submissions, images |   yes   |  yes   |   no   |   no    |

On top of that: a Board that is not `visible` is a draft (managers only); a
hidden Tile and a Tile of a Blind Board keep their cell but are managers only
(`hidden-tiles.ts`, `blind-board.ts`); on a battleship Board a Team's progress
is for that Team and managers only (`battleship-privacy.ts`); the tracker
verification code is managers only.

`canReadEvent`, `canReadBoard`, `canReadTile`, `canReadGoal` and `canReadTeam`
(`@/server/authz`) answer it for callers; the read functions use the richer
`getEventReadAccess`, `getBoardReadAccess` and `getTileReadAccess`.

## Decision 3: non-public Events, link holders or members only

- **Today / default (`link-holders`):** a signed-in user who has the link of a
  non-public Event gets the join card (title, dates, registration state, the
  join button) and nothing else (`getEventById` used to load the whole Event for
  them but the Event page only used the card). `getEventById` now returns the
  Event row with no Boards, Teams or Clan and `userRole: null`.
- Alternative (`members-only`): such a user gets nothing; `getEventById` is
  null and the Event page answers 404. They can still join through an invite
  code. The registration helpers (`isRegistrationOpen`, `requestToJoinEvent`,
  `joinEvent`) do not consult the policy yet, so `members-only` alone does not
  close joining by Event id.
- Change: `READ_DECISIONS.nonPublicEventForNonMembers`.

## Decision 4: uploads

- **Today / default (`public-url`):** any `/api/uploads/<file>` URL is served to
  whoever holds it, with `Cache-Control: public, max-age=31536000, immutable`.
  The file names are random (`nanoid`), so the URL is the secret.
- Alternative (`follow-event-visibility`): the file is served only to those who
  may see the Submission it belongs to (managers; participants for a Tile they
  may read, on a battleship Board only their own Team's), cached privately for
  an hour. A file no Submission refers to answers 404. Unauthenticated callers
  are refused, so a Discord embed or a pasted link no longer works for
  outsiders.
- Change: `READ_DECISIONS.uploads`.

## Decision 5: codephrase

- **Today / default (`players`):** managers and participants see a Board's
  codephrase (the Event page shows it in the info panel); everybody else never
  does, and the public pages blank it.
- Alternative (`managers`): managers only. The info panel then shows an empty
  codephrase to players.
- Change: `READ_DECISIONS.codephrase`.

## Rollout flag

`RBAC_READ_POLICY=enforce|relaxed` (optional, default `enforce`), read from the
environment on every request. `relaxed` reads a non-member like a participant
for the `content` and `member-data` gates, which is what the unguarded reads
allowed before. It never relaxes hidden / Blind Tiles, draft Boards, battleship
privacy, managers-only data, the codephrase or the verification code, and it
restores the public upload URL. A change needs the container restarted, not a
rebuild or a new image. See `docs/GITHUB-SECRETS.md` and `.env.example`.

## Left as it was (open for the maintainers)

- Participants of a standard Board see every Team's Submissions and images in
  the Event page data (`getEventById`), while `getAllSubmissionsForTeam` shows
  them to the Team and managers only. Both are unchanged.
- Event statistics and the leaderboard are `content` scope, so a public Event
  shows its leaderboard (it did already); per-player statistics are
  `member-data`.

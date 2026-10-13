# Bingoscape

The core domain model for the Bingoscape OSRS bingo platform.

## Language

**Event**:
A top-level bingo competition.
_Avoid_: Game, Bingo, Competition

**Team**:
A group of one or more players participating together in an Event.
_Avoid_: Clan, Group, Party

**Board**:
The grid of challenges played during an Event. (Note: The database refers to this entity as `bingos`.)
_Avoid_: Grid, Card, Bingo

**Tile**:
An individual square or challenge on a Board.
_Avoid_: Task, Drop, Square

**Blind Tile**:
A Tile of a battleship Board before its Event starts, as seen by anyone who does not manage the Event. It keeps its id and grid position (so ships can still be placed on it) but has no title, description, image, Goals or Submissions; the server marks it `isBlind`. From the start on, and forever after (also once the Event ended), nothing is blind. Not the same as a hidden Tile (`isHidden`), which can never hold a ship.
_Avoid_: Hidden Tile, Masked Tile

**Submission**:
A claim by a Team that they have completed a Tile. Can be manual (requiring admin approval) or automatic (instantly approved).
_Avoid_: Proof, Drop

**RuneLite Plugin**:
The official OSRS client integration that sends Submissions either manually or via automatic drop detection.

**Player**:
A participant in Bingoscape. A Player can only belong to one Team per Event. Their OSRS username is tracked, but if it changes, it currently requires manual updates in Bingoscape and Wise Old Man.
_Avoid_: User, Account

**Wise Old Man**:
The external OSRS group and stat tracking service integrated with Bingoscape.

**Owner**:
The Player who owns an Event (`events.creator_id`, always also an `admin` participant) or a Clan (`clans.owner_id`, always an `admin` member). Only the Event owner can delete the Event, grant the admin role and transfer ownership; all other admin permissions belong to every admin. If an Event's creator account no longer exists, its oldest admin acts as the owner. The owner can be neither demoted nor removed; ownership is handed over by an explicit transfer, after which the previous owner remains an admin.
_Avoid_: Creator (for the permission concept), Host

**Last admin**:
An Event and a Clan always keep at least one admin. A demotion or removal that would leave none is refused, also when two admins are demoted at the same moment (the Event or Clan row is locked while a role changes).

**Role change**:
Every change of an Event or Clan membership (join, add, role change, removal, ownership transfer) goes through `changeRole()` and its siblings in `src/server/authz/membership.ts`, in one transaction. Each writes one row to the `role_change_log` ledger (who, whom, old and new role, source, reason); replaying the ledger must give the live roles, which a daily reconciliation checks. Nobody grants or adds a role above their own.

**Clan**:
A persistent, long-term group of Players outside of any specific Event.
_Avoid_: Group, Guild

**Goal**:
The specific requirement(s) needed to complete a Tile (e.g., obtaining an item, gaining XP). Goals can be grouped logically (AND/OR/SUM).
_Avoid_: Requirement, Objective

**Prize Pool**:
The total OSRS GP available to be won in an Event, combining the base amount, Buy-Ins, and Donations.

**Buy-In**:
The entry fee to participate in an Event, paid in OSRS GP.

**Donation**:
Additional OSRS GP voluntarily contributed to an Event's Prize Pool.

**XP**:
The scoring metric earned by Teams for completing Tiles and securing Bonuses.
_Avoid_: Points, Score

**Bonus**:
Extra XP awarded for completing a specific pattern on the Board. Typically defined as a **Row Bonus**, **Column Bonus**, or **Diagonal Bonus**.
_Avoid_: Line Bonus

**Tier**:
A grouping of Tiles used in progressive bingos. Higher Tiers remain locked until a Team earns enough XP to unlock them.

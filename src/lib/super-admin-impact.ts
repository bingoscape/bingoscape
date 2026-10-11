import { plural } from "@/lib/super-admin-format"

export interface ImpactLine {
  text: string
  /** Emphasise lines that remove other people's data. */
  strong?: boolean
}

export interface DeleteImpact {
  /** Things that are permanently removed. */
  deletes: ImpactLine[]
  /** Things that survive the deletion, so the admin is not misled. */
  keeps: ImpactLine[]
}

export interface UserImpactCounts {
  createdEvents: number
  ownedClans: number
  clanMemberships: number
  eventParticipations: number
  /** Only known on the detail page. */
  submissions?: number
  /** Participants of the events they created, excluding the user. Detail page only. */
  othersInCreatedEvents?: number
}

/**
 * Mirrors `deleteUser` in actions/super-admin.ts: it deletes the user's team and
 * event memberships, clan memberships and every event they created (which cascades
 * to boards, tiles, teams, participants and submissions), then the user row.
 * Owned clans survive because `clans.owner_id` is `ON DELETE SET NULL`.
 */
export function userDeleteImpact(counts: UserImpactCounts): DeleteImpact {
  const deletes: ImpactLine[] = [
    { text: "The account, linked sign-in providers, sessions and API keys" },
  ]
  if (counts.createdEvents > 0) {
    const others =
      counts.othersInCreatedEvents !== undefined
        ? ` (${plural(counts.othersInCreatedEvents, "other participant")})`
        : ""
    deletes.push({
      text: `${plural(counts.createdEvents, "event")} they created, with all boards, tiles, teams, participants${others} and submissions inside them, including other players' data`,
      strong: true,
    })
  }
  if (counts.clanMemberships > 0) {
    deletes.push({
      text: `${plural(counts.clanMemberships, "clan membership")}`,
    })
  }
  if (counts.eventParticipations > 0) {
    deletes.push({
      text: `${plural(counts.eventParticipations, "event participation")} and their team memberships`,
    })
  }
  if (counts.submissions !== undefined && counts.submissions > 0) {
    deletes.push({
      text: `${plural(counts.submissions, "tile submission")} they made`,
    })
  }

  const keeps: ImpactLine[] = []
  if (counts.ownedClans > 0) {
    keeps.push({
      text: `${plural(counts.ownedClans, "clan")} they own stay${counts.ownedClans === 1 ? "s" : ""} but will have no owner`,
    })
  }
  return { deletes, keeps }
}

export interface ClanImpactCounts {
  members: number
  events: number
}

/** Mirrors `deleteClan`: memberships go, events are detached from the clan but kept. */
export function clanDeleteImpact(counts: ClanImpactCounts): DeleteImpact {
  return {
    deletes: [
      { text: `The clan and its ${plural(counts.members, "membership")}` },
      { text: "Clan invites" },
    ],
    keeps: [
      {
        text: `${plural(counts.events, "event")} stay${counts.events === 1 ? "s" : ""} but will no longer belong to a clan`,
      },
      { text: "User accounts of former members" },
    ],
  }
}

export interface EventImpactCounts {
  participants: number
  teams: number
  boards: number
  /** Detail page only. */
  tiles?: number
  /** Detail page only. */
  submissions?: number
}

/** Mirrors `deleteEvent`: everything inside the event goes. */
export function eventDeleteImpact(counts: EventImpactCounts): DeleteImpact {
  const deletes: ImpactLine[] = [
    { text: plural(counts.participants, "participant"), strong: true },
    { text: plural(counts.teams, "team") + " and their members" },
    { text: plural(counts.boards, "board") },
  ]
  if (counts.tiles !== undefined) {
    deletes.push({ text: plural(counts.tiles, "tile") })
  }
  if (counts.submissions !== undefined) {
    deletes.push({
      text: `${plural(counts.submissions, "tile submission")} and progress`,
      strong: true,
    })
  }
  return {
    deletes,
    keeps: [{ text: "The creator's account and the clan, if any" }],
  }
}

/** Removing a member only touches the membership row. */
export function memberRemoveImpact(
  scope: "clan" | "event",
  name: string
): DeleteImpact {
  return {
    deletes: [
      {
        text:
          scope === "clan"
            ? `${name}'s membership in this clan`
            : `${name}'s participation in this event`,
      },
    ],
    keeps: [
      { text: "Their user account" },
      {
        text:
          scope === "clan"
            ? "Their events, teams and submissions"
            : "Their team membership and any submissions they made",
      },
    ],
  }
}

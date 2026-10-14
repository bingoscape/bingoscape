import { eq, inArray } from "drizzle-orm"

import { hashApiKey } from "@/lib/api-key"
import { db } from "@/server/db"
import {
  apiKeys,
  discordWebhooks,
  eventDonations,
  eventParticipants,
  eventRegistrationRequests,
  eventRules,
  goalGroups,
  goalValues,
  images,
  submissions,
  teamTileSubmissions,
} from "@/server/db/schema"
import {
  createAuthzFixture,
  type AuthzFixture,
} from "@/server/__tests__/helpers/authz-fixture"

/**
 * The authz fixture plus the child rows of Event 2 that the id-taking actions
 * work on (goal group, goal value, submission, webhook, registration request,
 * donation, rule) and an API key for the Event 1 admin. Event 1 is the
 * attacker's Event (`admin` and `management` manage it), Event 2 the victim's:
 * there `admin` is a plain participant and `management` does not take part.
 */
export interface CrossEventFixture extends AuthzFixture {
  event2Extra: {
    goalGroupId: string
    goalValueId: string
    teamTileSubmissionId: string
    submissionId: string
    webhookId: string
    registrationRequestId: string
    donationId: string
    ruleId: string
  }
  adminApiKey: string
}

export async function createCrossEventFixture(): Promise<CrossEventFixture> {
  const base = await createAuthzFixture()
  const { users: u, event1, event2 } = base

  const [group] = await db
    .insert(goalGroups)
    .values({ tileId: event2.tileId, name: "Group 2", logicalOperator: "AND" })
    .returning({ id: goalGroups.id })
  const [value] = await db
    .insert(goalValues)
    .values({ goalId: event2.goalId, value: 1, description: "Value 2" })
    .returning({ id: goalValues.id })
  const [tts] = await db
    .insert(teamTileSubmissions)
    .values({
      tileId: event2.tileId,
      teamId: event2.teamId,
      status: "incomplete",
    })
    .returning({ id: teamTileSubmissions.id })
  const [image] = await db
    .insert(images)
    .values({ path: `/uploads/cross-${Math.random().toString(36).slice(2)}` })
    .returning({ id: images.id })
  const [submission] = await db
    .insert(submissions)
    .values({
      teamTileSubmissionId: tts!.id,
      imageId: image!.id,
      goalId: event2.goalId,
      submittedBy: u.admin,
      status: "pending",
    })
    .returning({ id: submissions.id })
  const [webhook] = await db
    .insert(discordWebhooks)
    .values({
      eventId: event2.id,
      name: "hook",
      webhookUrl: "https://discord.com/api/webhooks/1/abc",
      createdBy: u.otherCreator,
    })
    .returning({ id: discordWebhooks.id })
  const [request] = await db
    .insert(eventRegistrationRequests)
    .values({ eventId: event2.id, userId: u.outsider })
    .returning({ id: eventRegistrationRequests.id })
  const [participant] = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, event2.id))
    .limit(1)
  const [donation] = await db
    .insert(eventDonations)
    .values({ eventParticipantId: participant!.id, amount: 100 })
    .returning({ id: eventDonations.id })
  const [rule] = await db
    .insert(eventRules)
    .values({ eventId: event2.id, content: "Be nice" })
    .returning({ id: eventRules.id })
  const adminApiKey = `bsn_cross_${Math.random().toString(36).slice(2)}`
  await db
    .insert(apiKeys)
    .values({
      userId: u.admin,
      name: "cross-event",
      keyHash: hashApiKey(adminApiKey),
    })

  void event1
  return {
    ...base,
    event2Extra: {
      goalGroupId: group!.id,
      goalValueId: value!.id,
      teamTileSubmissionId: tts!.id,
      submissionId: submission!.id,
      webhookId: webhook!.id,
      registrationRequestId: request!.id,
      donationId: donation!.id,
      ruleId: rule!.id,
    },
    adminApiKey,
    cleanup: async () => {
      await db.delete(apiKeys).where(eq(apiKeys.keyHash, hashApiKey(adminApiKey)))
      await db.delete(submissions).where(eq(submissions.id, submission!.id))
      await db
        .delete(teamTileSubmissions)
        .where(eq(teamTileSubmissions.id, tts!.id))
      await db.delete(images).where(inArray(images.id, [image!.id]))
      await base.cleanup()
    },
  }
}

 
import { describe, beforeEach, expect, it, jest } from "@jest/globals"

jest.mock("@/server/auth", () => ({
  getServerAuthSession: jest.fn(),
}))

jest.mock("@/server/db", () => ({
  db: {
    query: {
      events: { findFirst: jest.fn() },
      eventParticipants: { findFirst: jest.fn() },
      eventRegistrationRequests: { findFirst: jest.fn() },
    },
    insert: jest.fn(() => ({ values: jest.fn() })),
  },
}))

jest.mock("nanoid", () => ({
  nanoid: () => "test-nanoid",
}))

describe("Event registration actions", () => {
  const { getServerAuthSession } = jest.requireMock("@/server/auth") as {
    getServerAuthSession: jest.Mock
  }
  const { db } = jest.requireMock("@/server/db") as any
  const { getUserRegistrationStatus, requestToJoinEvent } = require("../events")

  beforeEach(() => {
    jest.clearAllMocks()
    getServerAuthSession.mockResolvedValue({ user: { id: "user-123" } })
  })

  describe("getUserRegistrationStatus", () => {
    it("returns not_requested when unauthenticated", async () => {
      getServerAuthSession.mockResolvedValue(null)

      const result = await getUserRegistrationStatus("event-123")
      expect(result).toEqual({ status: "not_requested" })
    })

    it("returns approved when user is already a participant", async () => {
      db.query.eventParticipants.findFirst.mockResolvedValue({ id: "ep-1" })

      const result = await getUserRegistrationStatus("event-123")
      expect(result).toEqual({ status: "approved" })
    })

    it("returns not_requested when no request exists", async () => {
      db.query.eventParticipants.findFirst.mockResolvedValue(null)
      db.query.eventRegistrationRequests.findFirst.mockResolvedValue(null)

      const result = await getUserRegistrationStatus("event-123")
      expect(result).toEqual({ status: "not_requested" })
    })

    it("returns request status + event title", async () => {
      db.query.eventParticipants.findFirst.mockResolvedValue(null)
      db.query.eventRegistrationRequests.findFirst.mockResolvedValue({
        status: "rejected",
        message: "pls",
        responseMessage: "no",
        event: { title: "Test Event" },
      })

      const result = await getUserRegistrationStatus("event-123")
      expect(result).toEqual({
        status: "rejected",
        message: "pls",
        responseMessage: "no",
        eventTitle: "Test Event",
      })
    })
  })

  describe("requestToJoinEvent", () => {
    it("throws when unauthenticated", async () => {
      getServerAuthSession.mockResolvedValue(null)
      await expect(requestToJoinEvent("event-123", "hi")).rejects.toThrow(
        "You must be logged in to request to join an event"
      )
    })

    it("throws when event not found", async () => {
      db.query.events.findFirst.mockResolvedValue(null)
      await expect(requestToJoinEvent("event-123", "hi")).rejects.toThrow(
        "Event not found"
      )
    })

    it("throws when event does not require approval", async () => {
      db.query.events.findFirst.mockResolvedValue({
        id: "event-123",
        requiresApproval: false,
      })
      await expect(requestToJoinEvent("event-123", "hi")).rejects.toThrow(
        "This event does not require approval to join"
      )
    })
  })
})


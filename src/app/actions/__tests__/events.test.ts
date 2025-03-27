/* eslint-disable */
import { getUserRegistrationStatus, requestToJoinEvent } from "../events"
import { db } from "@/lib/db"
import { auth } from "@/auth"
import { describe, beforeEach, it, expect, jest } from "@jest/globals"

// Mock dependencies
jest.mock("@/lib/db", () => ({
  db: {
    eventParticipant: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}))

describe("Event Registration Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
      // Mock auth to return a user
      ; (auth as jest.Mock).mockResolvedValue({
        user: { id: "user-123", name: "Test User" },
      })
  })

  describe("getUserRegistrationStatus", () => {
    it("should return not_requested when user has no registration", async () => {
      // Mock db to return null (no registration found)
      ; (db.eventParticipant.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await getUserRegistrationStatus("event-123")

      expect(result).toEqual({ status: "not_requested" })
      expect(db.eventParticipant.findFirst).toHaveBeenCalledWith({
        where: {
          eventId: "event-123",
          userId: "user-123",
        },
      })
    })

    it("should return pending status when registration is pending", async () => {
      // Mock db to return a pending registration
      ; (db.eventParticipant.findFirst as jest.Mock).mockResolvedValue({
        status: "pending",
        message: "Please let me join",
        responseMessage: null,
      })

      const result = await getUserRegistrationStatus("event-123")

      expect(result).toEqual({
        status: "pending",
        message: "Please let me join",
        responseMessage: null,
      })
    })

    it("should return approved status when registration is approved", async () => {
      // Mock db to return an approved registration
      ; (db.eventParticipant.findFirst as jest.Mock).mockResolvedValue({
        status: "approved",
        message: "Please let me join",
        responseMessage: "Welcome!",
      })

      const result = await getUserRegistrationStatus("event-123")

      expect(result).toEqual({
        status: "approved",
        message: "Please let me join",
        responseMessage: "Welcome!",
      })
    })

    it("should return rejected status when registration is rejected", async () => {
      // Mock db to return a rejected registration
      ; (db.eventParticipant.findFirst as jest.Mock).mockResolvedValue({
        status: "rejected",
        message: "Please let me join",
        responseMessage: "Sorry, the event is full",
      })

      const result = await getUserRegistrationStatus("event-123")

      expect(result).toEqual({
        status: "rejected",
        message: "Please let me join",
        responseMessage: "Sorry, the event is full",
      })
    })

    it("should throw an error when user is not authenticated", async () => {
      // Mock auth to return no user
      ; (auth as jest.Mock).mockResolvedValue({ user: null })

      await expect(getUserRegistrationStatus("event-123")).rejects.toThrow(
        "You must be logged in to check registration status",
      )
    })
  })

  describe("requestToJoinEvent", () => {
    it("should create a pending registration request", async () => {
      // Mock db to return an event that requires approval
      ; (db.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-123",
        title: "Test Event",
        requiresApproval: true,
      })

        // Mock db to return null (no existing registration)
        ; (db.eventParticipant.findFirst as jest.Mock).mockResolvedValue(null)

        // Mock db to successfully create a registration
        ; (db.eventParticipant.create as jest.Mock).mockResolvedValue({
          id: "participant-123",
          eventId: "event-123",
          userId: "user-123",
          status: "pending",
          message: "Please approve me",
        })

      await requestToJoinEvent("event-123", "Please approve me")

      expect(db.eventParticipant.create).toHaveBeenCalledWith({
        data: {
          eventId: "event-123",
          userId: "user-123",
          status: "pending",
          message: "Please approve me",
        },
      })
    })

    it("should throw an error when user already has a registration", async () => {
      // Mock db to return an event that requires approval
      ; (db.event.findUnique as jest.Mock).mockResolvedValue({
        id: "event-123",
        title: "Test Event",
        requiresApproval: true,
      })

        // Mock db to return an existing registration
        ; (db.eventParticipant.findFirst as jest.Mock).mockResolvedValue({
          id: "participant-123",
          eventId: "event-123",
          userId: "user-123",
          status: "pending",
        })

      await expect(requestToJoinEvent("event-123", "Please approve me")).rejects.toThrow(
        "You have already requested to join this event",
      )
    })

    it("should throw an error when event does not exist", async () => {
      // Mock db to return null (event not found)
      ; (db.event.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(requestToJoinEvent("event-123", "Please approve me")).rejects.toThrow("Event not found")
    })
  })

  // Additional tests for joinEvent and joinEventViaInvite would follow a similar pattern
})


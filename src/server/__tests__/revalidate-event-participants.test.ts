import {
  eventParticipantPaths,
  revalidateEventParticipants,
} from "@/server/revalidate-event-participants"

const revalidatePath = jest.fn()
jest.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}))

describe("revalidateEventParticipants", () => {
  beforeEach(() => revalidatePath.mockClear())

  it("covers the event page and every management view of the participant data", () => {
    expect(eventParticipantPaths("evt")).toEqual([
      "/events/evt",
      "/events/evt/participants",
      "/events/evt/teams",
      "/events/evt/registrations",
    ])
  })

  it("revalidates each of those paths exactly once", () => {
    revalidateEventParticipants("evt")

    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(
      eventParticipantPaths("evt")
    )
  })
})

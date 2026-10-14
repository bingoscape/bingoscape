import { matchesRegistrationSearch } from "@/lib/registration-search"

const request = {
  message: "Happy to help with raids",
  user: {
    name: "Zezima",
    email: "zezima@example.com",
    runescapeName: "Zezima OSRS",
  },
}

describe("matchesRegistrationSearch", () => {
  it("matches everything for an empty or blank term", () => {
    expect(matchesRegistrationSearch(request, "")).toBe(true)
    expect(matchesRegistrationSearch(request, "   ")).toBe(true)
  })

  it("matches on the name", () => {
    expect(matchesRegistrationSearch(request, "zezi")).toBe(true)
  })

  it("matches on the email even though the name is set and does not match", () => {
    expect(matchesRegistrationSearch(request, "@example.com")).toBe(true)
  })

  it("matches on the RuneScape name even though the name is set and does not match", () => {
    expect(matchesRegistrationSearch(request, "osrs")).toBe(true)
  })

  it("matches on the message even though every other field is set and does not match", () => {
    expect(matchesRegistrationSearch(request, "raids")).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(matchesRegistrationSearch(request, "ZEZIMA@EXAMPLE")).toBe(true)
  })

  it("does not match a term that appears nowhere", () => {
    expect(matchesRegistrationSearch(request, "nothing-here")).toBe(false)
  })

  it("copes with null fields", () => {
    const sparse = {
      message: null,
      user: { name: null, email: "a@b.c", runescapeName: null },
    }
    expect(matchesRegistrationSearch(sparse, "a@b")).toBe(true)
    expect(matchesRegistrationSearch(sparse, "zzz")).toBe(false)
  })
})

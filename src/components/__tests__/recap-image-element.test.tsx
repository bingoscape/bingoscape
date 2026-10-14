/**
 * @jest-environment node
 *
 * The picture behind "Share as image" (team draft 4/4, #218): sized from the
 * rosters, every team and player on it, and a cap so it stays shareable.
 */
import type { ReactElement, ReactNode } from "react"

import { buildRecapImage } from "@/components/draft/recap/recap-image-element"
import { seedDraft } from "@/lib/draft/__tests__/draft-seed"

/** All the text in a React element tree. */
function textOf(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean") {
    return []
  }
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)]
  }
  if (Array.isArray(node)) return node.flatMap(textOf)
  const element = node as ReactElement<{ children?: ReactNode }>
  return textOf(element.props.children)
}

/** Satori only knows flexbox: every element with children must be a flex box. */
function nonFlexContainers(node: ReactNode): number {
  if (!node || typeof node !== "object") return 0
  if (Array.isArray(node))
    return node.reduce<number>((n, c) => n + nonFlexContainers(c), 0)
  const element = node as ReactElement<{
    children?: ReactNode
    style?: { display?: string }
  }>
  const { children, style } = element.props
  const hasElementChildren = Array.isArray(children)
    ? children.some((c) => c && typeof c === "object")
    : !!children && typeof children === "object"
  const own = hasElementChildren && style?.display !== "flex" ? 1 : 0
  return own + nonFlexContainers(children)
}

describe("buildRecapImage", () => {
  it("draws every team with its captain and players", () => {
    const { state, players } = seedDraft({ teams: 4, players: 24 })
    const image = buildRecapImage("Summer Bingo", state, players)
    const text = textOf(image.element)
    expect(text).toContain("Team draft")
    expect(text.join(" ")).toContain("Summer Bingo")
    for (const team of ["Team 1", "Team 2", "Team 3", "Team 4"]) {
      expect(text).toContain(team)
    }
    expect(text).toContain("Captain c0")
    expect(text).toContain("p0")
    expect(text).toContain("p23")
  })

  it("is 1200 wide and as high as the biggest team needs", () => {
    const small = buildRecapImage(
      "E",
      seedDraft({ teams: 2, players: 4 }).state,
      seedDraft({ teams: 2, players: 4 }).players
    )
    const big = seedDraft({ teams: 2, players: 20 })
    const large = buildRecapImage("E", big.state, big.players)
    expect(small.width).toBe(1200)
    expect(large.width).toBe(1200)
    expect(large.height).toBeGreaterThan(small.height)
  })

  it("lays more than four teams out in rows", () => {
    const four = seedDraft({ teams: 4, players: 8 })
    const eight = seedDraft({ teams: 8, players: 16 })
    const a = buildRecapImage("E", four.state, four.players)
    const b = buildRecapImage("E", eight.state, eight.players)
    expect(b.height).toBeGreaterThan(a.height)
  })

  it("cuts a huge roster off and says how many more there are", () => {
    const seed = seedDraft({ teams: 2, players: 60 })
    const image = buildRecapImage("E", seed.state, seed.players)
    const text = textOf(image.element)
    // 30 picks plus the captain per team: 14 rows are drawn, 17 are left out.
    expect(text).toContain("+17 more")
    expect(text).not.toContain("p59")
  })

  it("says when the teams are not applied yet", () => {
    const { state, players } = seedDraft({ teams: 2, players: 4 })
    expect(
      textOf(buildRecapImage("E", state, players).element).join(" ")
    ).toContain("not applied yet")
    const applied = buildRecapImage("E", { ...state, applied: true }, players)
    expect(textOf(applied.element).join(" ")).not.toContain("not applied yet")
  })

  it("uses only flex containers, which is all Satori can draw", () => {
    const { state, players } = seedDraft({ teams: 4, players: 24 })
    expect(
      nonFlexContainers(buildRecapImage("E", state, players).element)
    ).toBe(0)
  })
})

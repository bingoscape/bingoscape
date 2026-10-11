import { fireEvent, render, screen } from "@testing-library/react"

import TemplatePreviewWithTooltip from "@/components/template-preview-with-tooltip"
import { parseExportedBingo } from "@/lib/bingo-template-schema"
import { buildDetailPreview } from "@/lib/template-preview"

const parsed = parseExportedBingo({
  version: "2.0",
  metadata: {
    title: "T",
    rows: 1,
    columns: 3,
    bingoType: "progression",
    completeBoardBonusXP: 0,
  },
  tiles: [
    {
      title: "Easy one",
      description: "Do the easy thing",
      weight: 5,
      index: 0,
      isHidden: false,
      tier: 0,
      goals: [{ description: "Kills", targetValue: 10 }],
    },
    {
      title: "Secret boss",
      description: "Spoiler text",
      weight: 40,
      index: 1,
      isHidden: true,
      tier: 1,
    },
    {
      title: "Hard one",
      description: "",
      weight: 20,
      index: 2,
      isHidden: false,
      tier: 1,
    },
  ],
  tierXpRequirements: [{ tier: 0, xpRequired: 5 }],
})
if (!parsed.success) throw new Error(parsed.error)

describe("TemplatePreviewWithTooltip", () => {
  it("shows the first tile's details without any hover", () => {
    render(
      <TemplatePreviewWithTooltip
        title="Board"
        preview={buildDetailPreview(parsed.data, { isOwner: false })}
      />
    )

    expect(
      screen.getByRole("heading", { name: "Easy one" })
    ).toBeInTheDocument()
    expect(screen.getByText("Do the easy thing")).toBeInTheDocument()
    expect(screen.getByText("Target: 10")).toBeInTheDocument()
  })

  it("selects a tile on tap and steps with Next", () => {
    render(
      <TemplatePreviewWithTooltip
        title="Board"
        preview={buildDetailPreview(parsed.data, { isOwner: false })}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Hard one/ }))
    expect(screen.getByRole("heading", { name: "Hard one" })).toBeVisible()
    expect(screen.getByText("Tile 3 of 3")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Previous" }))
    expect(screen.getByText("Tile 2 of 3")).toBeInTheDocument()
  })

  it("never renders masked tile content for non-owners", () => {
    render(
      <TemplatePreviewWithTooltip
        title="Board"
        preview={buildDetailPreview(parsed.data, { isOwner: false })}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Hidden tile/ }))

    expect(screen.getByRole("heading", { name: "???" })).toBeInTheDocument()
    expect(screen.queryByText("Secret boss")).not.toBeInTheDocument()
    expect(screen.queryByText("Spoiler text")).not.toBeInTheDocument()
  })

  it("shows hidden tiles to the owner and labels them", () => {
    render(
      <TemplatePreviewWithTooltip
        title="Board"
        preview={buildDetailPreview(parsed.data, { isOwner: true })}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Secret boss/ }))

    expect(screen.getByText("Spoiler text")).toBeInTheDocument()
    expect(
      screen.getByText("Hidden from players until revealed")
    ).toBeInTheDocument()
  })

  it("lists the tier ladder for progression boards", () => {
    render(
      <TemplatePreviewWithTooltip
        title="Board"
        preview={buildDetailPreview(parsed.data, { isOwner: false })}
      />
    )

    expect(
      screen.getByRole("heading", { name: "Tier ladder" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Earn 5 XP in this tier to unlock Tier 2.")
    ).toBeInTheDocument()
  })
})

import { render, screen } from "@testing-library/react"
import {
  getItemDisplayName,
  ItemOption,
} from "@/components/osrs-item-option"
import {
  ABYSSAL_WHIP,
  DRAGON_DAGGER_P,
} from "./item-fixtures"

describe("getItemDisplayName", () => {
  it("leaves plain names alone", () => {
    expect(getItemDisplayName(ABYSSAL_WHIP)).toBe("Abyssal whip")
  })

  it("reads a stored variant the way players write it", () => {
    expect(getItemDisplayName({ name: "Dragon dagger#(p)" })).toBe(
      "Dragon dagger (p)"
    )
    expect(getItemDisplayName({ name: "Holy scythe#Charged" })).toBe(
      "Holy scythe Charged"
    )
  })
})

describe("ItemOption", () => {
  it("shows the item name and an icon, but never the item id", () => {
    const { container } = render(<ItemOption item={ABYSSAL_WHIP} />)

    expect(screen.getByText("Abyssal whip")).toBeInTheDocument()
    expect(container.querySelector("img")).toBeInTheDocument()
    expect(container).not.toHaveTextContent("4151")
    expect(container).not.toHaveTextContent("ID")
  })

  it("shows the display name of a variant", () => {
    render(<ItemOption item={DRAGON_DAGGER_P} />)

    expect(screen.getByText("Dragon dagger (p)")).toBeInTheDocument()
  })
})

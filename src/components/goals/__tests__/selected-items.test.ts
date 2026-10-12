import { mergeSelectedItems } from "@/components/goals/selected-items"
import type { SelectedItem } from "@/components/goals/types"
import {
  ABYSSAL_TENTACLE,
  ABYSSAL_WHIP,
  DRAGON_DAGGER_P,
} from "./item-fixtures"

const sel = (item: SelectedItem["item"], quantity: string): SelectedItem => ({
  item,
  quantity,
})

describe("mergeSelectedItems", () => {
  it("appends new items in order with their quantity as text", () => {
    expect(
      mergeSelectedItems(
        [sel(ABYSSAL_WHIP, "1")],
        [
          { item: ABYSSAL_TENTACLE, quantity: 2 },
          { item: DRAGON_DAGGER_P, quantity: 1000 },
        ]
      )
    ).toEqual([
      sel(ABYSSAL_WHIP, "1"),
      sel(ABYSSAL_TENTACLE, "2"),
      sel(DRAGON_DAGGER_P, "1000"),
    ])
  })

  it("sums the quantity of an item that is already selected", () => {
    expect(
      mergeSelectedItems(
        [sel(ABYSSAL_WHIP, "2"), sel(ABYSSAL_TENTACLE, "1")],
        [{ item: ABYSSAL_WHIP, quantity: 3 }]
      )
    ).toEqual([sel(ABYSSAL_WHIP, "5"), sel(ABYSSAL_TENTACLE, "1")])
  })

  it("sums an item that is listed twice in the additions", () => {
    expect(
      mergeSelectedItems(
        [],
        [
          { item: ABYSSAL_WHIP, quantity: 1 },
          { item: ABYSSAL_WHIP, quantity: 2 },
        ]
      )
    ).toEqual([sel(ABYSSAL_WHIP, "3")])
  })

  it("matches an item with several ids by its first id", () => {
    expect(
      mergeSelectedItems(
        [sel(DRAGON_DAGGER_P, "1")],
        [{ item: { ...DRAGON_DAGGER_P }, quantity: 1 }]
      )
    ).toEqual([sel(DRAGON_DAGGER_P, "2")])
  })

  it("understands shorthand in the selected quantity", () => {
    expect(
      mergeSelectedItems(
        [sel(ABYSSAL_WHIP, "1k")],
        [{ item: ABYSSAL_WHIP, quantity: 500 }]
      )
    ).toEqual([sel(ABYSSAL_WHIP, "1500")])
  })

  it("replaces a selected quantity that is not a valid number", () => {
    expect(
      mergeSelectedItems(
        [sel(ABYSSAL_WHIP, "")],
        [{ item: ABYSSAL_WHIP, quantity: 4 }]
      )
    ).toEqual([sel(ABYSSAL_WHIP, "4")])
  })

  it("caps the sum at the largest goal target", () => {
    expect(
      mergeSelectedItems(
        [sel(ABYSSAL_WHIP, "2147483647")],
        [{ item: ABYSSAL_WHIP, quantity: 5 }]
      )
    ).toEqual([sel(ABYSSAL_WHIP, "2147483647")])
  })

  it("does not change the selection it is given", () => {
    const selected = [sel(ABYSSAL_WHIP, "1")]
    mergeSelectedItems(selected, [
      { item: ABYSSAL_WHIP, quantity: 1 },
      { item: ABYSSAL_TENTACLE, quantity: 1 },
    ])
    expect(selected).toEqual([sel(ABYSSAL_WHIP, "1")])
  })
})

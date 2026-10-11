import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { GoalEditForm } from "@/components/goals/goal-edit-form"
import type { GoalNodeData } from "@/components/goals/types"
import { updateItemGoal, updateMetricGoal } from "@/app/actions/bingo"
import { searchOsrsItems } from "@/app/actions/osrs-items"
import "./dom-polyfills"
import { searchFixtureItems } from "./item-fixtures"

jest.mock("@/app/actions/bingo", () => ({
  updateGoal: jest.fn(),
  updateItemGoal: jest.fn(),
  updateMetricGoal: jest.fn(),
}))
jest.mock("@/app/actions/osrs-items", () => ({ searchOsrsItems: jest.fn() }))

const mockedUpdateItemGoal = updateItemGoal as jest.Mock
const mockedUpdateMetricGoal = updateMetricGoal as jest.Mock
const mockedSearch = searchOsrsItems as jest.MockedFunction<
  typeof searchOsrsItems
>

const itemGoal = {
  id: "goal-item",
  tileId: "t1",
  parentGroupId: null,
  description: "Abyssal whip",
  targetValue: 2,
  goalType: "item",
  orderIndex: 0,
  itemGoal: {
    itemId: 4151,
    baseName: "Abyssal whip",
    exactVariant: null,
    imageUrl: "/whip.png",
  },
} as unknown as GoalNodeData

const metricGoal = {
  id: "goal-metric",
  tileId: "t1",
  parentGroupId: null,
  description: "Zulrah",
  targetValue: 50,
  goalType: "metric",
  orderIndex: 0,
  metricGoal: { metricType: "boss", metricName: "zulrah" },
} as unknown as GoalNodeData

function renderForm(goalId: string, goalData: GoalNodeData) {
  const onClose = jest.fn()
  const onRefresh = jest.fn()
  render(
    <GoalEditForm
      goalId={goalId}
      goalData={goalData}
      onClose={onClose}
      onRefresh={onRefresh}
    />
  )
  return { onClose, onRefresh }
}

describe("GoalEditForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSearch.mockImplementation(async (query) => searchFixtureItems(query))
  })

  describe("an item goal", () => {
    it("starts with the goal's item and quantity", () => {
      renderForm("goal-item", itemGoal)

      expect(screen.getByRole("combobox")).toHaveTextContent("Abyssal whip")
      expect(screen.getByLabelText("Quantity")).toHaveValue("2")
    })

    it("saves the same item with a new quantity", async () => {
      mockedUpdateItemGoal.mockResolvedValue({ success: true })
      const { onClose, onRefresh } = renderForm("goal-item", itemGoal)

      fireEvent.change(screen.getByLabelText("Quantity"), {
        target: { value: "5" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Save" }))

      await waitFor(() => expect(onRefresh).toHaveBeenCalled())
      expect(mockedUpdateItemGoal).toHaveBeenCalledWith(
        "goal-item",
        4151,
        "Abyssal whip",
        "Abyssal whip",
        "/whip.png",
        null,
        5
      )
      expect(onClose).toHaveBeenCalled()
    })

    it("changes the item through the single-select search", async () => {
      mockedUpdateItemGoal.mockResolvedValue({ success: true })
      const { onRefresh } = renderForm("goal-item", itemGoal)

      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.change(await screen.findByPlaceholderText("Search OSRS items..."), {
        target: { value: "tentacle" },
      })
      const option = await screen.findByRole(
        "option",
        { name: "Abyssal tentacle" },
        { timeout: 2000 }
      )
      // No item id in the visible result.
      expect(option).not.toHaveTextContent(/ID/)
      fireEvent.click(option)

      // The search closes and the trigger shows the new item.
      await waitFor(() =>
        expect(screen.getByRole("combobox")).toHaveTextContent(
          "Abyssal tentacle"
        )
      )
      fireEvent.click(screen.getByRole("button", { name: "Save" }))

      await waitFor(() => expect(onRefresh).toHaveBeenCalled())
      expect(mockedUpdateItemGoal).toHaveBeenCalledWith(
        "goal-item",
        12006,
        "Abyssal tentacle",
        "Abyssal tentacle",
        "/tentacle.png",
        null,
        2
      )
    })

    it("selects one item at a time: choosing a result replaces the item", async () => {
      renderForm("goal-item", itemGoal)

      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.change(await screen.findByPlaceholderText("Search OSRS items..."), {
        target: { value: "dragon dagger" },
      })
      fireEvent.click(
        await screen.findByRole(
          "option",
          { name: "Dragon dagger (p)" },
          { timeout: 2000 }
        )
      )

      await waitFor(() =>
        expect(screen.getByRole("combobox")).toHaveTextContent(
          "Dragon dagger (p)"
        )
      )
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
    })

    it("blocks saving an invalid quantity", () => {
      renderForm("goal-item", itemGoal)

      fireEvent.change(screen.getByLabelText("Quantity"), {
        target: { value: "0" },
      })

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    })
  })

  describe("an XP / Kills goal", () => {
    it("saves its current values unchanged", async () => {
      mockedUpdateMetricGoal.mockResolvedValue({ success: true })
      const { onClose, onRefresh } = renderForm("goal-metric", metricGoal)

      fireEvent.click(screen.getByRole("button", { name: "Save" }))

      await waitFor(() => expect(onRefresh).toHaveBeenCalled())
      expect(mockedUpdateMetricGoal).toHaveBeenCalledWith(
        "goal-metric",
        "boss",
        "zulrah",
        50,
        "zulrah (boss)"
      )
      expect(onClose).toHaveBeenCalled()
    })

    it("still offers the type and name as selects", () => {
      renderForm("goal-metric", metricGoal)

      expect(screen.getByRole("combobox", { name: "Track" })).toBeInTheDocument()
      expect(screen.getByRole("combobox", { name: "Boss" })).toBeInTheDocument()
    })
  })
})

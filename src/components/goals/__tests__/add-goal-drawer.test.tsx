import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { AddGoalDrawer } from "@/components/goals/add-goal-drawer"
import "./dom-polyfills"
import { addGoal, createGoals, createMetricGoal } from "@/app/actions/bingo"

jest.mock("@/app/actions/bingo", () => ({
  addGoal: jest.fn(),
  createGoals: jest.fn(),
  createMetricGoal: jest.fn(),
}))
// The item search is its own component; stand in for it with buttons that pick items.
jest.mock("@/components/osrs-item-search", () => ({
  OsrsItemSearch: ({
    onItemSelect,
    autoFocus,
  }: {
    onItemSelect: (items: unknown[]) => void
    autoFocus?: boolean
  }) => (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={() =>
        onItemSelect([
          {
            id: 4151,
            name: "Abyssal whip",
            baseName: "Abyssal whip",
            variant: null,
            imageUrl: "/whip.png",
          },
        ])
      }
    >
      Pick whip
    </button>
  ),
}))

const mockedAddGoal = addGoal as jest.Mock
const mockedCreateGoals = createGoals as jest.Mock
const mockedCreateMetricGoal = createMetricGoal as jest.Mock

function renderDrawer(
  props: Partial<React.ComponentProps<typeof AddGoalDrawer>> = {}
) {
  const onOpenChange = jest.fn()
  const onRefresh = jest.fn()
  const utils = render(
    <AddGoalDrawer
      open
      onOpenChange={onOpenChange}
      tileId="t1"
      parentGroupId={null}
      onRefresh={onRefresh}
      womLinked
      {...props}
    />
  )
  return { onOpenChange, onRefresh, ...utils }
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /^add (item|goal|xp)/i }))

describe("AddGoalDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("has a description, so Radix does not warn about a missing one", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    renderDrawer()

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      /press done/i
    )
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Missing `Description`")
    )
    warn.mockRestore()
  })

  it("starts on the Item type with the item search focused", () => {
    renderDrawer()

    expect(screen.getByRole("radio", { name: "Item" })).toBeChecked()
    expect(screen.getByRole("button", { name: "Pick whip" })).toHaveFocus()
  })

  it("focuses the first field of the chosen type", () => {
    renderDrawer()

    fireEvent.click(screen.getByRole("radio", { name: "Other" }))
    expect(screen.getByLabelText("Description")).toHaveFocus()

    fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
    expect(screen.getByRole("combobox", { name: "Skill" })).toHaveFocus()
  })

  describe("type radio group", () => {
    it("is a labelled radiogroup with one checked radio", () => {
      renderDrawer()

      const group = screen.getByRole("radiogroup", { name: "Goal type" })
      const radios = within(group).getAllByRole("radio")
      expect(radios).toHaveLength(3)
      expect(
        radios.filter((r) => r.getAttribute("aria-checked") === "true")
      ).toHaveLength(1)
    })

    it("moves focus and selection with the arrow keys", async () => {
      renderDrawer()
      const item = screen.getByRole("radio", { name: "Item" })
      act(() => item.focus())

      // Radix moves focus on the next tick, and selection follows focus.
      fireEvent.keyDown(item, { key: "ArrowRight" })
      await waitFor(() =>
        expect(screen.getByRole("radio", { name: "XP / Kills" })).toBeChecked()
      )
      // The new form must not steal focus from the radio group.
      expect(screen.getByRole("radio", { name: "XP / Kills" })).toHaveFocus()

      fireEvent.keyDown(screen.getByRole("radio", { name: "XP / Kills" }), {
        key: "ArrowRight",
      })
      await waitFor(() =>
        expect(screen.getByRole("radio", { name: "Other" })).toBeChecked()
      )

      fireEvent.keyDown(screen.getByRole("radio", { name: "Other" }), {
        key: "ArrowLeft",
      })
      await waitFor(() =>
        expect(screen.getByRole("radio", { name: "XP / Kills" })).toBeChecked()
      )
    })
  })

  describe("adding several goals in a row", () => {
    it("keeps the drawer open and the type, clears the fields and lists what was added", async () => {
      mockedAddGoal.mockResolvedValue({ success: true, goal: {} })
      const { onOpenChange, onRefresh } = renderDrawer({ parentGroupId: "g1" })

      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Complete a raid" },
      })
      fireEvent.change(screen.getByLabelText("Target"), {
        target: { value: "2" },
      })
      submit()

      await waitFor(() =>
        expect(screen.getByText("Complete a raid x2")).toBeInTheDocument()
      )
      expect(mockedAddGoal).toHaveBeenCalledWith("t1", {
        description: "Complete a raid",
        targetValue: 2,
        parentGroupId: "g1",
      })
      expect(onRefresh).toHaveBeenCalledTimes(1)
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByRole("radio", { name: "Other" })).toBeChecked()
      expect(screen.getByLabelText("Description")).toHaveValue("")
      expect(screen.getByLabelText("Description")).toHaveFocus()
      expect(screen.getByText(/Add New Goal to Group/)).toBeInTheDocument()
    })

    it("adds item goals, stays open on Item and lists them most recent first, capped", async () => {
      mockedCreateGoals.mockResolvedValue({ success: true, goals: [{}] })
      const { onOpenChange } = renderDrawer()

      for (let i = 1; i <= 6; i++) {
        fireEvent.click(screen.getByRole("button", { name: "Pick whip" }))
        fireEvent.change(screen.getByLabelText("Quantity per item"), {
          target: { value: String(i) },
        })
        submit()
        await waitFor(() =>
          expect(screen.getByText(`Abyssal whip x${i}`)).toBeInTheDocument()
        )
      }

      const status = screen.getByRole("status", { name: "Added goals" })
      const entries = within(status).getAllByRole("listitem")
      expect(entries.map((e) => e.textContent)).toEqual([
        "Abyssal whip x6",
        "Abyssal whip x5",
        "Abyssal whip x4",
      ])
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByRole("radio", { name: "Item" })).toBeChecked()
      expect(screen.getByLabelText("Quantity per item")).toHaveValue("1")
      expect(
        screen.getByRole("button", { name: /add item goal/i })
      ).toBeDisabled()
    })

    it("adds an XP goal with shorthand and keeps the XP / Kills type", async () => {
      mockedCreateMetricGoal.mockResolvedValue({ success: true, goal: {} })
      const { onOpenChange } = renderDrawer()

      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
      fireEvent.click(screen.getByRole("combobox", { name: "Skill" }))
      fireEvent.click(
        await screen.findByRole("option", { name: /woodcutting/i })
      )
      fireEvent.change(screen.getByLabelText("XP to gain"), {
        target: { value: "2.5m" },
      })
      submit()

      await waitFor(() =>
        expect(
          screen.getByText("Woodcutting: 2,500,000 XP")
        ).toBeInTheDocument()
      )
      expect(mockedCreateMetricGoal).toHaveBeenCalledWith(
        "t1",
        "skill",
        "woodcutting",
        2_500_000,
        undefined,
        null
      )
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByRole("radio", { name: "XP / Kills" })).toBeChecked()
      expect(screen.getByLabelText("XP to gain")).toHaveValue("")
    })

    it("closes with Done", async () => {
      const { onOpenChange } = renderDrawer()

      fireEvent.click(screen.getByRole("button", { name: "Done" }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("keeps the form and shows an error when the server rejects the goal", async () => {
      mockedAddGoal.mockResolvedValue({ success: false, error: "Nope" })
      renderDrawer()

      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Task" },
      })
      submit()

      await waitFor(() => expect(mockedAddGoal).toHaveBeenCalled())
      expect(screen.getByLabelText("Description")).toHaveValue("Task")
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
    })
  })

  describe("submitting", () => {
    it("submits with Enter in a field when the form is valid", async () => {
      mockedAddGoal.mockResolvedValue({ success: true, goal: {} })
      renderDrawer()
      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Task" },
      })

      fireEvent.submit(screen.getByLabelText("Description").closest("form")!)

      await waitFor(() => expect(mockedAddGoal).toHaveBeenCalledTimes(1))
    })

    it("does not submit an invalid form and says why", () => {
      renderDrawer()
      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Task" },
      })
      fireEvent.change(screen.getByLabelText("Target"), {
        target: { value: "0" },
      })

      fireEvent.submit(screen.getByLabelText("Description").closest("form")!)

      expect(mockedAddGoal).not.toHaveBeenCalled()
      const button = screen.getByRole("button", { name: /^add goal$/i })
      expect(button).toBeDisabled()
      expect(button).toHaveAccessibleDescription(/greater than 0/i)
    })

    it("explains why Add is disabled for each type", () => {
      renderDrawer()
      expect(
        screen.getByText("Select at least one item to add.")
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
      expect(screen.getByText("Select a skill to add.")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("radio", { name: "Other" }))
      expect(
        screen.getByText("Enter a description to add this goal.")
      ).toBeInTheDocument()
    })
  })

  describe("XP / Kills form", () => {
    beforeEach(() => {
      renderDrawer()
      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))
    })

    it("offers skill presets that fill the target, including Level 99", () => {
      const presets = screen.getByRole("group", { name: "XP to gain presets" })
      expect(
        within(presets)
          .getAllByRole("button")
          .map((b) => b.textContent)
      ).toEqual(["100K", "500K", "1M", "5M", "Level 99 (13,034,431 XP)"])

      fireEvent.click(within(presets).getByRole("button", { name: "500K" }))
      expect(screen.getByLabelText("XP to gain")).toHaveValue("500000")
      expect(screen.getByText("= 500,000 XP")).toBeInTheDocument()
      expect(
        within(presets).getByRole("button", { name: "500K" })
      ).toHaveAttribute("aria-pressed", "true")

      fireEvent.click(
        within(presets).getByRole("button", { name: /level 99/i })
      )
      expect(screen.getByLabelText("XP to gain")).toHaveValue("13034431")
    })

    it("switches labels and presets for bosses and activities", async () => {
      fireEvent.click(screen.getByRole("combobox", { name: "Track" }))
      fireEvent.click(
        await screen.findByRole("option", { name: "Boss (kills)" })
      )

      expect(screen.getByLabelText("Kills")).toBeInTheDocument()
      expect(
        within(screen.getByRole("group", { name: "Kills presets" }))
          .getAllByRole("button")
          .map((b) => b.textContent)
      ).toEqual(["5", "10", "25", "50", "100"])
      expect(screen.getByText(/Counts kills by the team/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole("combobox", { name: "Track" }))
      fireEvent.click(
        await screen.findByRole("option", { name: "Activity (score)" })
      )
      expect(screen.getByLabelText("Score")).toBeInTheDocument()
      expect(
        screen.queryByRole("group", { name: /presets/ })
      ).not.toBeInTheDocument()
    })

    it("explains what the target counts", () => {
      expect(
        screen.getByText(
          /Counts XP gained by the team during the event window \(via Wise Old Man\)/
        )
      ).toBeInTheDocument()
    })

    it("shows no Wise Old Man notice when a competition is linked", () => {
      expect(screen.queryByText(/won.t sync/)).not.toBeInTheDocument()
    })
  })

  describe("Wise Old Man notice", () => {
    it("warns, without blocking, when no competition is linked", () => {
      renderDrawer({ womLinked: false })
      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))

      expect(
        screen.getByText(
          /XP and kill progress won.t sync until a Wise Old Man competition is linked/
        )
      ).toBeInTheDocument()
      // Not a blocker: the add button is limited only by the missing skill.
      expect(screen.getByText("Select a skill to add.")).toBeInTheDocument()
    })

    it("closes the drawer and opens the tracker settings from the link", () => {
      const onOpenTrackerSettings = jest.fn()
      const { onOpenChange } = renderDrawer({
        womLinked: false,
        onOpenTrackerSettings,
      })
      fireEvent.click(screen.getByRole("radio", { name: "XP / Kills" }))

      fireEvent.click(
        screen.getByRole("button", { name: "Open tracker settings" })
      )

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(onOpenTrackerSettings).toHaveBeenCalledTimes(1)
    })

    it("is not shown for item goals", () => {
      renderDrawer({ womLinked: false })

      expect(screen.queryByText(/won.t sync/)).not.toBeInTheDocument()
    })
  })
})

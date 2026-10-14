import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { ChangeTeamDialog, EditRoleDialog } from "@/components/participants-tab"
import type { Participant } from "@/app/events/[id]/(manage)/participants/types"

// The tab pulls in server actions; the dialogs under test never call them.
jest.mock("@/app/actions/events", () => ({}))
jest.mock("@/components/donation-management-modal", () => ({
  DonationManagementModal: () => null,
}))
jest.mock("@/components/events/add-clan-members-dialog", () => ({
  AddClanMembersDialog: () => null,
}))

const participant: Participant = {
  id: "user-1",
  runescapeName: "Zezima",
  role: "management",
  teamId: "team-b",
  teamName: "Beta",
  buyIn: 0,
  totalDonations: 0,
}

const teams = [
  { id: "team-a", name: "Alpha" },
  { id: "team-b", name: "Beta" },
]

describe("EditRoleDialog", () => {
  it("pre-selects the participant's current role when it opens", () => {
    const { rerender } = render(
      <EditRoleDialog
        isOpen={false}
        onClose={jest.fn()}
        participant={null}
        onRoleChange={jest.fn()}
        assignableRoles={["participant", "management"]}
      />
    )

    rerender(
      <EditRoleDialog
        isOpen
        onClose={jest.fn()}
        participant={participant}
        onRoleChange={jest.fn()}
        assignableRoles={["participant", "management"]}
      />
    )

    expect(screen.getByRole("combobox")).toHaveTextContent(/manage/i)
  })

  it("saving without a change closes without calling the action", () => {
    const onClose = jest.fn()
    const onRoleChange = jest.fn()
    render(
      <EditRoleDialog
        isOpen
        onClose={onClose}
        participant={participant}
        onRoleChange={onRoleChange}
        assignableRoles={["participant", "management"]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    expect(onRoleChange).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})

describe("ChangeTeamDialog", () => {
  it("pre-selects the participant's current team when it opens", () => {
    const { rerender } = render(
      <ChangeTeamDialog
        isOpen={false}
        onClose={jest.fn()}
        participant={null}
        teams={teams}
        onTeamChange={jest.fn()}
      />
    )

    rerender(
      <ChangeTeamDialog
        isOpen
        onClose={jest.fn()}
        participant={participant}
        teams={teams}
        onTeamChange={jest.fn()}
      />
    )

    expect(screen.getByRole("combobox")).toHaveTextContent("Beta")
  })

  it("shows No Team for a participant without a team and saves without calling the action", async () => {
    const onClose = jest.fn()
    const onTeamChange = jest.fn()
    render(
      <ChangeTeamDialog
        isOpen
        onClose={onClose}
        participant={{ ...participant, teamId: null, teamName: null }}
        teams={teams}
        onTeamChange={onTeamChange}
      />
    )

    expect(screen.getByRole("combobox")).toHaveTextContent("No Team")
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onTeamChange).not.toHaveBeenCalled()
  })
})

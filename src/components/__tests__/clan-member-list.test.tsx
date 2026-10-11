import { render, screen, within } from "@testing-library/react"

import {
  ClanMemberList,
  type ClanMemberListMember,
} from "@/components/clan-member-list"
import type { ClanRole } from "@/lib/clan"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}))
jest.mock("@/app/actions/clan", () => ({ updateMemberRole: jest.fn() }))
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))

const members: ClanMemberListMember[] = [
  { id: "owner", name: "o", runescapeName: "Owner", image: null, role: "admin" },
  { id: "me", name: "m", runescapeName: "Me", image: null, role: "management" },
  { id: "u3", name: "u", runescapeName: "Third", image: null, role: "member" },
]

function renderList(viewerRole: ClanRole, viewerId: string) {
  render(
    <ClanMemberList
      clanId="c1"
      members={members}
      viewerId={viewerId}
      viewerRole={viewerRole}
      ownerId="owner"
    />
  )
}

describe("ClanMemberList role controls", () => {
  it.each(["management", "member", "guest"] as const)(
    "hides role controls from a %s",
    (role) => {
      renderList(role, "me")
      expect(screen.queryAllByRole("combobox")).toHaveLength(0)
    }
  )

  it("shows controls to admins, but not on their own or the owner's row", () => {
    renderList("admin", "me")
    // Rendered twice (cards < lg, table >= lg); only Third is editable.
    const controls = screen.getAllByRole("combobox")
    expect(controls).toHaveLength(2)
    controls.forEach((c) =>
      expect(c).toHaveAccessibleName("Role for Third")
    )
  })

  it("marks the viewer and the owner", () => {
    renderList("management", "me")
    const list = screen.getByRole("list", { name: "Clan members" })
    expect(within(list).getByText("You")).toBeInTheDocument()
    expect(within(list).getByText("Owner", { selector: "div" })).toBeInTheDocument()
  })
})

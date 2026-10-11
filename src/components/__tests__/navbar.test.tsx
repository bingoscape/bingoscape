import { render, screen } from "@testing-library/react"
import { Navbar } from "@/components/navbar"

const mockUseSession = jest.fn()

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: jest.fn(),
}))
jest.mock("next/navigation", () => ({ usePathname: () => "/" }))
jest.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}))
jest.mock("@/components/mode-toggle", () => ({
  __esModule: true,
  default: () => <button type="button">Theme</button>,
  ThemeMenuItems: () => null,
}))

describe("Navbar", () => {
  it("offers only Log in and Sign up, with no menu, when logged out", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" })
    render(<Navbar />)

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/sign-in"
    )
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/sign-up"
    )
    expect(
      screen.queryByRole("button", { name: /toggle menu/i })
    ).not.toBeInTheDocument()
  })

  it("shows the menu, merged Events link and account menu when logged in", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", name: "Zezima", image: null } },
      status: "authenticated",
    })
    render(<Navbar />)

    expect(
      screen.getByRole("button", { name: /toggle menu/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Account menu" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Events/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      screen.queryByRole("link", { name: "My Events" })
    ).not.toBeInTheDocument()
  })
})

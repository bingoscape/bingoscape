"use client"

import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User, Home, Users, Menu, FileJson, Shield } from "lucide-react"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { BrandWordmark } from "./brand-wordmark"
import ModeToggle, { ThemeMenuItems } from "./mode-toggle"
import { NotificationBell } from "./notification-bell"
import { cn } from "@/lib/utils"

interface NavbarProps {
  isSuperAdminUser?: boolean
}

const navItems = [
  { href: "/", label: "Events", icon: Home },
  { href: "/clans", label: "Clans", icon: Users },
  { href: "/templates", label: "Templates", icon: FileJson },
  {
    href: "/super-admin",
    label: "Admin Panel",
    icon: Shield,
    adminOnly: true,
  },
]

// Yellow focus ring that stays visible on the stone navbar in both themes
// (the themed --ring token is dark orange in the light theme).
const navFocus =
  "focus-visible:ring-2 focus-visible:ring-osrs-yellow focus-visible:ring-offset-1 focus-visible:ring-offset-osrs-stone-800 focus-visible:outline-hidden"

export function Navbar({ isSuperAdminUser = false }: NavbarProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || isSuperAdminUser
  )

  return (
    <nav
      aria-label="Main"
      className="osrs-panel bg-osrs-stone-800 text-osrs-parchment sticky top-0 z-50 mb-(--nav-gap) h-(--nav-h) w-full border-x-0 border-t-0 shadow-md"
    >
      <div className="container mx-auto flex h-full min-w-0 items-center justify-between gap-2 px-4">
        <div className="flex h-full min-w-0 items-center gap-1 sm:gap-3">
          {session?.user && (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-osrs-parchment hover:bg-osrs-stone-600 hover:text-osrs-yellow lg:hidden",
                    navFocus
                  )}
                >
                  <Menu aria-hidden="true" className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))]"
              >
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="mt-6 flex flex-col gap-4">
                  <BrandWordmark className="self-start" />
                  <hr className="osrs-divider" />
                  <ul className="flex flex-col gap-2">
                    {visibleItems.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "group font-display focus-visible:ring-ring focus-visible:ring-offset-background flex min-h-12 items-center gap-3 rounded-sm px-3 py-3 text-base focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden",
                              isActive
                                ? "osrs-btn"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                            onClick={() => setIsOpen(false)}
                          >
                            <item.icon
                              aria-hidden="true"
                              className="h-5 w-5 shrink-0"
                            />
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </SheetContent>
            </Sheet>
          )}
          <Link
            href="/"
            aria-label="BingoScape home"
            className={cn("group rounded-sm", navFocus)}
          >
            <BrandWordmark />
          </Link>
          {session?.user && (
            <ul className="ml-2 hidden h-full items-stretch lg:flex">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <li key={item.href} className="flex">
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group font-display osrs-text-shadow focus-visible:ring-osrs-yellow relative flex items-center gap-2 px-4 text-base transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset",
                        isActive
                          ? "bg-osrs-stone-900 text-osrs-gold after:bg-osrs-gold"
                          : "text-osrs-parchment hover:bg-osrs-stone-700 hover:text-osrs-yellow hover:after:bg-osrs-stone-500"
                      )}
                    >
                      <item.icon
                        aria-hidden="true"
                        className="hidden h-4 w-4 shrink-0 xl:block"
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {status === "loading" ? (
          <div className="flex items-center gap-3">
            <div className="bg-osrs-stone-700 hidden h-8 w-20 animate-pulse rounded-sm md:block" />
            <div className="bg-osrs-stone-700 h-8 w-8 animate-pulse rounded-full" />
            <div className="bg-osrs-stone-700 h-8 w-8 animate-pulse rounded-full" />
          </div>
        ) : session?.user ? (
          <div className="[&_button:focus-visible]:ring-osrs-yellow [&_button:hover]:bg-osrs-stone-600 [&_button:hover]:text-osrs-yellow [&_button]:text-osrs-parchment [&_button]:ring-offset-osrs-stone-800 flex shrink-0 items-center gap-1 sm:gap-2">
            <span className="font-display text-osrs-parchment osrs-text-shadow mr-1 hidden max-w-40 truncate text-base xl:inline">
              {session.user.runescapeName || session.user.name}
            </span>
            <div className="hidden sm:block">
              <ModeToggle />
            </div>
            <NotificationBell userId={session.user.id} />
            <span
              aria-hidden="true"
              className="bg-osrs-stone-950 mx-1 hidden h-6 w-0.5 shadow-[1px_0_0_var(--color-osrs-stone-600)] sm:block"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label="Account menu"
                  className="relative size-10 rounded-full p-0 pointer-coarse:size-11"
                >
                  <Avatar className="ring-osrs-stone-500 h-8 w-8 ring-1">
                    <AvatarImage src={session.user.image ?? undefined} alt="" />
                    <AvatarFallback className="bg-osrs-stone-900 font-display text-osrs-gold">
                      {session.user.name?.[0] ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.image ?? undefined} alt="" />
                    <AvatarFallback className="bg-osrs-stone-900 font-display text-osrs-gold">
                      {session.user.name?.[0] ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col space-y-1">
                    <p className="truncate text-sm font-medium">
                      {session.user.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {session.user.runescapeName || session.user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <ThemeMenuItems className="sm:hidden" />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-danger focus:text-danger flex items-center"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className={cn(
                "text-osrs-parchment hover:bg-osrs-stone-600 hover:text-osrs-yellow",
                navFocus
              )}
            >
              <Link href="/sign-in">Log in</Link>
            </Button>
            <Button asChild className={navFocus}>
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        )}
      </div>
    </nav>
  )
}

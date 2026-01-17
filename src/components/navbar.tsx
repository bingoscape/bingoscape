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
import {
  LogOut,
  User,
  Home,
  Users,
  Menu,
  Calendar,
  FileJson,
  Shield,
  Zap,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import ModeToggle from "./mode-toggle"
import { NotificationBell } from "./notification-bell"
import { cn } from "@/lib/utils"

export function Navbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false)

  useEffect(() => {
    if (session?.user?.email) {
      // Check if user is super admin
      fetch("/api/super-admin/check")
        .then((res) => res.json())
        .then((data: { isSuperAdmin: boolean }) =>
          setIsSuperAdminUser(data.isSuperAdmin)
        )
        .catch(() => setIsSuperAdminUser(false))
    }
  }, [session?.user?.email])

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/clans", label: "Clans", icon: Users },
    { href: "/events/mine", label: "My Events", icon: Calendar },
    { href: "/templates", label: "Templates", icon: FileJson },
    {
      href: "/super-admin",
      label: "Admin Panel",
      icon: Shield,
      adminOnly: true,
    },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur transition-all duration-300 supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-6">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="mt-6 flex flex-col space-y-2">
                <div className="mb-4 flex items-center space-x-2 border-b pb-4">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="text-lg font-bold">BingoScape</span>
                </div>
                {navItems
                  .filter((item) => !item.adminOnly || isSuperAdminUser)
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center space-x-3 rounded-md px-3 py-2 transition-all duration-200 hover:bg-accent",
                        pathname === item.href
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 transition-colors",
                          pathname === item.href
                            ? "text-primary-foreground"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
              </div>
            </SheetContent>
          </Sheet>
          <Link
            href="/"
            className="flex items-center space-x-2 text-xl font-bold transition-opacity hover:opacity-80"
          >
            <Zap className="h-6 w-6 text-primary" />
            <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              BingoScape
            </span>
          </Link>
          {session?.user && (
            <div className="hidden items-center space-x-1 md:flex">
              {navItems
                .filter((item) => !item.adminOnly || isSuperAdminUser)
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-3 py-2 transition-colors duration-200 hover:bg-accent",
                      pathname === item.href
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "hidden h-4 w-4 transition-colors lg:inline",
                        pathname === item.href
                          ? "text-primary-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
            </div>
          )}
        </div>
        {status === "loading" ? (
          <div className="flex items-center space-x-3">
            <div className="hidden h-8 w-20 animate-pulse rounded-md bg-muted md:block" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          </div>
        ) : session?.user ? (
          <div className="flex items-center space-x-3">
            <span className="hidden max-w-32 truncate text-sm font-medium text-muted-foreground lg:inline">
              {session.user.runescapeName || session.user.name}
            </span>
            <ModeToggle />
            <NotificationBell userId={session.user.id} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full ring-2 ring-transparent transition-all duration-200 hover:ring-primary/20"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={session.user.image ?? undefined}
                      alt={session.user.name ?? ""}
                    />
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                      {session.user.name?.[0] ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={session.user.image ?? undefined}
                      alt={session.user.name ?? ""}
                    />
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                      {session.user.name?.[0] ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{session.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex items-center text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Link href="/sign-in">
            <Button className="bg-primary text-primary-foreground transition-colors hover:bg-primary/90">
              Log in
            </Button>
          </Link>
        )}
      </div>
    </nav>
  )
}

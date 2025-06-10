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
import { LogOut, User, Home, Users, Menu, Calendar, FileJson, Shield } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import ModeToggle from "./mode-toggle"
import { NotificationBell } from "./notification-bell"

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
        .then((data) => setIsSuperAdminUser(data.isSuperAdmin))
        .catch(() => setIsSuperAdminUser(false))
    }
  }, [session?.user?.email])

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/clans", label: "Clans", icon: Users },
    { href: "/events/mine", label: "My Events", icon: Calendar },
    { href: "/templates", label: "Templates", icon: FileJson },
    { href: "/super-admin", label: "Admin Panel", icon: Shield, adminOnly: true },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1e293b] bg-[#020817] text-white">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <div className="flex flex-col space-y-4 mt-4">
                {navItems
                  .filter((item) => !item.adminOnly || isSuperAdminUser)
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-2 hover:text-foreground/80 transition-colors ${pathname === item.href ? "font-semibold" : ""}`}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="text-xl font-bold">
            BingoScape
          </Link>
          {session?.user && (
            <>
              <div className="hidden md:flex items-center space-x-4">
                {navItems
                  .filter((item) => !item.adminOnly || isSuperAdminUser)
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-1 hover:text-foreground/80 transition-colors ${pathname === item.href ? "font-semibold" : ""}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
              </div>
            </>
          )}
        </div>
        {status === "loading" ? (
          <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
        ) : session?.user ? (
          <div className="flex items-center space-x-4">
            <span className="hidden md:inline">{session.user.runescapeName || session.user.name}</span>
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ""} />
                    <AvatarFallback>{session.user.name?.[0] ?? "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="flex items-center">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NotificationBell userId={session.user.id} />
          </div>
        ) : (
          <Link href="/sign-in">
            <Button className="bg-white text-[#020817] hover:bg-white/90">Log in</Button>
          </Link>
        )}
      </div>
    </nav>
  )
}

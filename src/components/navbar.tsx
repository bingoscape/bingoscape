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
import { LogOut, User, Home, Users, Menu, Calendar, FileJson, Shield, Zap } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
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
        .then((data: { isSuperAdmin: boolean }) => setIsSuperAdminUser(data.isSuperAdmin))
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
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden hover:bg-accent">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <div className="flex flex-col space-y-2 mt-6">
                <div className="flex items-center space-x-2 mb-4 pb-4 border-b">
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
                        "flex items-center space-x-3 px-3 py-2 rounded-md transition-all duration-200 hover:bg-accent group",
                        pathname === item.href
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:text-foreground text-muted-foreground"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className={cn(
                        "h-4 w-4 transition-colors",
                        pathname === item.href ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center space-x-2 text-xl font-bold hover:opacity-80 transition-opacity">
            <Zap className="h-6 w-6 text-primary" />
            <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              BingoScape
            </span>
          </Link>
          {session?.user && (
            <>
              <div className="hidden md:flex items-center space-x-1">
                {navItems
                  .filter((item) => !item.adminOnly || isSuperAdminUser)
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 hover:bg-accent group",
                        pathname === item.href
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:text-foreground text-muted-foreground"
                      )}
                    >
                      <item.icon className={cn(
                        "h-4 w-4 transition-colors",
                        pathname === item.href ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
              </div>
            </>
          )}
        </div>
        {status === "loading" ? (
          <div className="flex items-center space-x-3">
            <div className="h-8 w-20 animate-pulse bg-muted rounded-md hidden md:block" />
            <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
            <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
          </div>
        ) : session?.user ? (
          <div className="flex items-center space-x-3">
            <span className="hidden lg:inline text-sm font-medium text-muted-foreground truncate max-w-32">
              {session.user.runescapeName || session.user.name}
            </span>
            <ModeToggle />
            <NotificationBell userId={session.user.id} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all duration-200">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {session.user.name?.[0] ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {session.user.name?.[0] ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
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
                <DropdownMenuItem onClick={() => signOut()} className="flex items-center text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Link href="/sign-in">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Log in
            </Button>
          </Link>
        )}
      </div>
    </nav>
  )
}

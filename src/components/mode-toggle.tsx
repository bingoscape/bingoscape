"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/** Theme choices as plain menu items, for embedding in another menu (mobile account menu). */
export function ThemeMenuItems({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={className}>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Theme
      </DropdownMenuLabel>
      {options.map((option) => (
        <DropdownMenuItem
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            "flex items-center gap-2",
            theme === option.value && "text-primary"
          )}
        >
          <option.icon aria-hidden="true" className="h-4 w-4" />
          <span>{option.label}</span>
        </DropdownMenuItem>
      ))}
    </div>
  )
}

export default function ModeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydration pattern for SSR
    setMounted(true)
  }, [])

  // Reserve the button's footprint so the navbar doesn't shift on mount.
  if (!mounted) {
    return <div aria-hidden="true" className="size-10" />
  }

  const current = options.find((o) => o.value === theme) ?? options[2]
  const CurrentIcon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: ${current.label}. Change theme`}
        >
          <CurrentIcon className="h-[1.2rem] w-[1.2rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex items-center gap-2",
              theme === option.value && "text-primary"
            )}
          >
            <option.icon className="h-4 w-4" />
            <span>{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

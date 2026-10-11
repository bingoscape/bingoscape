"use client"

import { useState } from "react"
import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { JoinEventForm } from "./join-event-form"

export function JoinEventPopover() {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <LogIn aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Join Event
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-[min(22rem,calc(100vw-1rem))]"
      >
        <JoinEventForm idPrefix="join-popover" onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

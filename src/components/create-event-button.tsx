"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CreateEventModal } from "@/components/create-event-modal"
import { Plus } from "lucide-react"

export function CreateEventButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Event
      </Button>
      <CreateEventModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

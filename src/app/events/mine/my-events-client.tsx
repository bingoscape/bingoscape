"use client"

import { useState } from "react"
import { CreateEventModal } from "@/components/create-event-modal"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function MyEventsClient() {
  const [createModalOpen, setCreateModalOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setCreateModalOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Event
      </Button>
      <CreateEventModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </>
  )
}

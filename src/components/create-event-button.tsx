"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { CreateEventModal } from "./create-event-modal"

export function CreateEventButton() {
  const router = useRouter()
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const handleEventCreated = async () => {
    // Trigger a refetch of Server Components
    router.refresh()
  }

  return (
    <>
      <Button
        size="sm"
        className="bg-primary text-primary-foreground shadow-xs transition-all hover:bg-primary/90"
        onClick={() => setCreateModalOpen(true)}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        New Event
      </Button>
      <CreateEventModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onEventCreated={handleEventCreated}
      />
    </>
  )
}

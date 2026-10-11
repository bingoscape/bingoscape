"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, MoreHorizontal } from "lucide-react"

import { leaveClan } from "@/app/actions/clan"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

interface ClanActionsMenuProps {
  clanId: string
  clanName: string
}

/** Overflow menu for members who can leave (everyone but the owner). */
export function ClanActionsMenu({ clanId, clanName }: ClanActionsMenuProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleLeave = async () => {
    try {
      const result = await leaveClan(clanId)
      if (!result.success) {
        toast({
          title: "Couldn't leave clan",
          description: result.error,
          variant: "destructive",
        })
        return
      }
      toast({ title: "You left the clan", description: clanName })
      router.push("/clans")
      router.refresh()
    } catch {
      toast({
        title: "Couldn't leave clan",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="More clan actions"
            className="w-full sm:w-auto"
          >
            <MoreHorizontal aria-hidden="true" />
            <span className="sm:sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-danger pointer-coarse:min-h-11"
            onSelect={() => setConfirmOpen(true)}
          >
            <LogOut aria-hidden="true" />
            Leave clan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Leave ${clanName}?`}
        description="You'll lose access to this clan's page and members list. You can only rejoin with a new invite link."
        confirmLabel="Leave clan"
        pendingLabel="Leaving…"
        variant="destructive"
        onConfirm={handleLeave}
      />
    </>
  )
}

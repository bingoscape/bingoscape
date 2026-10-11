"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatInTimeZone } from "date-fns-tz"
import { Ban, Copy, MoreVertical, Pencil, Ticket, Trash2 } from "lucide-react"

import {
  deleteClanInvite,
  revokeClanInvite,
  updateClanInviteLabel,
} from "@/app/actions/clan"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import {
  INVITE_STATUS_LABELS,
  MAX_INVITE_LABEL_LENGTH,
  buildClanInviteUrl,
  getInviteStatus,
  type InviteStatus,
} from "@/lib/clan"

export interface ClanInviteItem {
  id: string
  inviteCode: string
  label: string | null
  expiresAt: Date | null
  createdAt: Date
  maxUses: number | null
  currentUses: number
  isActive: boolean
  creator: { name: string | null; runescapeName: string | null } | null
}

interface ClanInvitesManagementProps {
  invites: ClanInviteItem[]
}

const STATUS_VARIANT: Record<InviteStatus, BadgeProps["variant"]> = {
  active: "success",
  exhausted: "secondary",
  expired: "warning",
  revoked: "destructive",
}

// Calendar dates only, formatted in UTC so server and browser render the same.
const day = (d: Date | string) => formatInTimeZone(new Date(d), "UTC", "MMM d, yyyy")

const inviteName = (i: ClanInviteItem) => i.label?.trim() || "Untitled invite"

function usesText(i: ClanInviteItem) {
  return i.maxUses === null
    ? `${i.currentUses} used`
    : `${i.currentUses} / ${i.maxUses} used`
}

function expiryText(i: ClanInviteItem) {
  return i.expiresAt ? day(i.expiresAt) : "Never"
}

function creatorText(i: ClanInviteItem) {
  return i.creator?.runescapeName ?? i.creator?.name ?? "Unknown"
}

type Dialogs =
  | { kind: "label"; invite: ClanInviteItem }
  | { kind: "revoke"; invite: ClanInviteItem }
  | { kind: "delete"; invite: ClanInviteItem }

export function ClanInvitesManagement({ invites }: ClanInvitesManagementProps) {
  const router = useRouter()
  const [dialog, setDialog] = useState<Dialogs | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [labelValue, setLabelValue] = useState("")
  const [labelPending, setLabelPending] = useState(false)

  const copyLink = async (invite: ClanInviteItem) => {
    try {
      await navigator.clipboard.writeText(
        buildClanInviteUrl(window.location.origin, invite.inviteCode)
      )
      toast({ title: "Copied", description: "Invite link copied to clipboard." })
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      })
    }
  }

  const openLabel = (invite: ClanInviteItem) => {
    setDialog({ kind: "label", invite })
    setLabelValue(invite.label ?? "")
    setLabelOpen(true)
  }

  const openConfirm = (kind: "revoke" | "delete", invite: ClanInviteItem) => {
    setDialog({ kind, invite })
    setConfirmOpen(true)
  }

  const run = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    success: string,
    failure: string
  ) => {
    try {
      const result = await action()
      if (!result.success) {
        toast({
          title: failure,
          description: result.error,
          variant: "destructive",
        })
        return false
      }
      toast({ title: success })
      router.refresh()
      return true
    } catch {
      toast({
        title: failure,
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
      return false
    }
  }

  const saveLabel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (dialog?.kind !== "label") return
    setLabelPending(true)
    const ok = await run(
      () => updateClanInviteLabel(dialog.invite.id, labelValue),
      "Label updated",
      "Couldn't update label"
    )
    setLabelPending(false)
    if (ok) setLabelOpen(false)
  }

  const confirmAction = async () => {
    if (!dialog || dialog.kind === "label") return
    const { kind, invite } = dialog
    if (kind === "revoke") {
      await run(
        () => revokeClanInvite(invite.id),
        "Invite revoked",
        "Couldn't revoke invite"
      )
    } else {
      await run(
        () => deleteClanInvite(invite.id),
        "Invite deleted",
        "Couldn't delete invite"
      )
    }
  }

  const actions = (invite: ClanInviteItem, status: InviteStatus) => (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void copyLink(invite)}
      >
        <Copy aria-hidden="true" />
        Copy link
        <span className="sr-only"> for {inviteName(invite)}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`More actions for ${inviteName(invite)}`}
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="pointer-coarse:min-h-11"
            onSelect={() => openLabel(invite)}
          >
            <Pencil aria-hidden="true" />
            Edit label
          </DropdownMenuItem>
          {status === "active" && (
            <DropdownMenuItem
              className="pointer-coarse:min-h-11"
              onSelect={() => openConfirm("revoke", invite)}
            >
              <Ban aria-hidden="true" />
              Revoke
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-danger pointer-coarse:min-h-11"
            onSelect={() => openConfirm("delete", invite)}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  if (invites.length === 0) {
    return (
      <div className="osrs-panel rounded-sm p-6 text-center sm:p-8">
        <div className="osrs-slot mx-auto mb-3 w-fit rounded-sm p-3">
          <Ticket aria-hidden="true" className="size-8 text-primary" />
        </div>
        <h3 className="osrs-heading text-lg font-bold">No invite links yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a link above and share it. Invites are the only way to join
          this clan.
        </p>
      </div>
    )
  }

  const statusOf = (i: ClanInviteItem) => getInviteStatus(i)
  const description =
    dialog?.kind === "revoke" ? (
      <>
        Anyone who opens{" "}
        <strong>{inviteName(dialog.invite)}</strong> will see that it was
        revoked. People who already joined stay in the clan.
      </>
    ) : dialog?.kind === "delete" ? (
      <>
        <strong>{inviteName(dialog.invite)}</strong> will be permanently
        removed. This can&apos;t be undone.
      </>
    ) : (
      ""
    )

  return (
    <>
      <ul role="list" aria-label="Invite links" className="space-y-2 lg:hidden">
        {invites.map((invite) => {
          const status = statusOf(invite)
          return (
            <li
              key={invite.id}
              className="osrs-panel flex flex-col gap-3 rounded-sm p-3 sm:p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{inviteName(invite)}</p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {invite.inviteCode}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[status]}>
                  {INVITE_STATUS_LABELS[status]}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Uses</dt>
                <dd>{usesText(invite)}</dd>
                <dt className="text-muted-foreground">Expires</dt>
                <dd>{expiryText(invite)}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>
                  {day(invite.createdAt)} by {creatorText(invite)}
                </dd>
              </dl>
              {actions(invite, status)}
            </li>
          )
        })}
      </ul>

      <div className="osrs-panel hidden rounded-sm p-2 lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invite</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => {
              const status = statusOf(invite)
              return (
                <TableRow key={invite.id}>
                  <TableCell>
                    <p className="font-medium">{inviteName(invite)}</p>
                    <p className="font-mono text-sm text-muted-foreground">
                      {invite.inviteCode}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[status]}>
                      {INVITE_STATUS_LABELS[status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{usesText(invite)}</TableCell>
                  <TableCell>{expiryText(invite)}</TableCell>
                  <TableCell>
                    {day(invite.createdAt)}
                    <span className="block text-sm text-muted-foreground">
                      by {creatorText(invite)}
                    </span>
                  </TableCell>
                  <TableCell>{actions(invite, status)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={labelOpen}
        onOpenChange={(next) => {
          if (!labelPending) setLabelOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit invite label</DialogTitle>
            <DialogDescription>
              Labels are only visible to clan managers.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveLabel} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-edit-label">Label</Label>
              <Input
                id="invite-edit-label"
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                maxLength={MAX_INVITE_LABEL_LENGTH}
                autoComplete="off"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={labelPending}
                onClick={() => setLabelOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={labelPending}>
                {labelPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={dialog?.kind === "delete" ? "Delete invite?" : "Revoke invite?"}
        description={description}
        confirmLabel={dialog?.kind === "delete" ? "Delete invite" : "Revoke invite"}
        pendingLabel={dialog?.kind === "delete" ? "Deleting…" : "Revoking…"}
        variant="destructive"
        onConfirm={confirmAction}
      />
    </>
  )
}

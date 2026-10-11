"use client"

import { useState } from "react"
import type React from "react"
import { Shield, UserMinus } from "lucide-react"

import {
  removeClanMember,
  removeEventParticipant,
  updateClanMemberRole,
  updateEventParticipantRole,
} from "@/app/actions/super-admin"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { memberRemoveImpact } from "@/lib/super-admin-impact"
import {
  AdminEditDialog,
  EditDialogFooter,
  useEditDialog,
} from "./admin-edit-dialog"
import { FormError } from "./admin-form-field"
import { ConfirmDestructiveDialog } from "./confirm-destructive-dialog"
import { RowActionsMenu, type RowAction } from "./row-actions-menu"
import { runAdminAction } from "./run-admin-action"

type Scope = "clan" | "event"

const ROLES: Record<Scope, { value: string; label: string; hint: string }[]> = {
  clan: [
    { value: "admin", label: "Admin", hint: "Full control" },
    { value: "management", label: "Management", hint: "Can manage members" },
    { value: "member", label: "Member", hint: "Regular member" },
    { value: "guest", label: "Guest", hint: "Observer only" },
  ],
  event: [
    { value: "admin", label: "Admin", hint: "Full control" },
    { value: "management", label: "Management", hint: "Can manage the event" },
    { value: "participant", label: "Participant", hint: "Plays the event" },
  ],
}

export const ROLE_BADGE_CLASS: Record<string, string> = {
  admin: "border-pending/40 bg-pending/15 text-pending",
  management: "border-info/40 bg-info/15 text-info",
  member: "border-success/40 bg-success/15 text-success",
  participant: "border-success/40 bg-success/15 text-success",
  guest: "border-border bg-muted text-muted-foreground",
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className={ROLE_BADGE_CLASS[role]}>
      {role}
    </Badge>
  )
}

interface MembershipActionsProps {
  scope: Scope
  /** Clan id or event id. */
  parentId: string
  parentName: string
  member: {
    userId: string
    label: string
    confirmText: string
    role: string
  }
  isLastAdmin: boolean
  /** When set, role changes and removal are disabled with this explanation. */
  lockedReason?: string
}

/** Role change + removal for one clan member or event participant. */
export function MembershipActions({
  scope,
  parentId,
  parentName,
  member,
  isLastAdmin,
  lockedReason,
}: MembershipActionsProps) {
  const [dialog, setDialog] = useState<"role" | "remove" | null>(null)
  const noun = scope === "clan" ? "member" : "participant"
  const parentNoun = scope === "clan" ? "clan" : "event"

  const actions: RowAction[] = [
    {
      key: "role",
      label: "Change role",
      icon: Shield,
      onSelect: () => setDialog("role"),
      disabledReason: lockedReason,
    },
    {
      key: "remove",
      label: `Remove from ${parentNoun}`,
      icon: UserMinus,
      onSelect: () => setDialog("remove"),
      destructive: true,
      disabledReason: lockedReason,
    },
  ]

  return (
    <>
      <RowActionsMenu subject={member.label} actions={actions} />
      <AdminEditDialog
        open={dialog === "role"}
        onOpenChange={(open) => setDialog(open ? "role" : null)}
        title="Change role"
        description={`Set the role of ${member.label} in ${parentName}.`}
      >
        <RoleForm
          scope={scope}
          parentId={parentId}
          parentNoun={parentNoun}
          member={member}
          isLastAdmin={isLastAdmin}
        />
      </AdminEditDialog>
      <ConfirmDestructiveDialog
        open={dialog === "remove"}
        onOpenChange={(open) => setDialog(open ? "remove" : null)}
        title={`Remove ${noun}`}
        description={`Remove ${member.label} from ${parentName}.${
          isLastAdmin
            ? ` They are the last admin, so the ${parentNoun} will be left without one.`
            : ""
        }`}
        confirmText={member.confirmText}
        impact={memberRemoveImpact(scope, member.label)}
        confirmLabel={`Remove ${noun}`}
        pendingLabel="Removing…"
        successTitle={`${noun === "member" ? "Member" : "Participant"} removed`}
        successDescription={`${member.label} was removed from ${parentName}.`}
        onConfirm={() =>
          runAdminAction(
            () =>
              scope === "clan"
                ? removeClanMember(parentId, member.userId)
                : removeEventParticipant(parentId, member.userId),
            `Could not remove the ${noun}.`
          )
        }
      />
    </>
  )
}

function RoleForm({
  scope,
  parentId,
  parentNoun,
  member,
  isLastAdmin,
}: {
  scope: Scope
  parentId: string
  parentNoun: string
  member: MembershipActionsProps["member"]
  isLastAdmin: boolean
}) {
  const { pending, setPending, close } = useEditDialog()
  const { toast } = useToast()
  const [role, setRole] = useState(member.role)
  const [formError, setFormError] = useState<string | null>(null)
  const changed = role !== member.role

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!changed) return
    setFormError(null)
    setPending(true)
    const result = await runAdminAction(
      () =>
        scope === "clan"
          ? updateClanMemberRole(
              parentId,
              member.userId,
              role as "admin" | "management" | "member" | "guest"
            )
          : updateEventParticipantRole(
              parentId,
              member.userId,
              role as "admin" | "management" | "participant"
            ),
      "Could not change the role. Nothing was changed."
    )
    setPending(false)
    if (!result.success) {
      setFormError(result.error ?? null)
      toast({
        title: "Could not change role",
        description: result.error,
        variant: "destructive",
      })
      return
    }
    // Template literal, not an HTML entity: toasts render plain text.
    toast({
      title: "Role updated",
      description: `${member.label}'s role is now ${role}.`,
    })
    close()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Current role</span>
        <RoleBadge role={member.role} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`role-${member.userId}`}>New role</Label>
        <Select value={role} onValueChange={setRole} disabled={pending}>
          <SelectTrigger id={`role-${member.userId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES[scope].map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}{" "}
                <span className="text-muted-foreground text-xs">
                  ({option.hint})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isLastAdmin && role !== "admin" ? (
        <p className="border-warning/50 bg-warning/10 rounded-sm border p-3 text-sm">
          This is the last admin. Saving leaves the {parentNoun} without any
          admin.
        </p>
      ) : null}
      <FormError message={formError} />
      <EditDialogFooter
        submitLabel="Update role"
        pendingLabel="Updating…"
        disabled={!changed}
      />
    </form>
  )
}

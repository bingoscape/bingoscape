"use client"

import { useState } from "react"
import type React from "react"
import { useRouter } from "next/navigation"

import { deleteClan, updateClan } from "@/app/actions/super-admin"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { SelectOption } from "@/lib/super-admin-format"
import {
  clanDeleteImpact,
  type ClanImpactCounts,
} from "@/lib/super-admin-impact"
import { AdminCombobox } from "./admin-combobox"
import {
  AdminEditDialog,
  EditDialogFooter,
  useEditDialog,
} from "./admin-edit-dialog"
import { FormError, FormField } from "./admin-form-field"
import { ConfirmDestructiveDialog } from "./confirm-destructive-dialog"
import { EntityActions } from "./entity-actions"
import { runAdminAction } from "./run-admin-action"

export interface ClanActionsClan {
  id: string
  name: string
  description: string | null
  ownerId: string | null
}

interface ClanActionsProps {
  clan: ClanActionsClan
  counts: ClanImpactCounts
  variant: "menu" | "buttons"
  /**
   * Owner candidates (the clan's members). Only the detail page has them; in
   * lists the owner field is left out and the name/description form is shown.
   */
  ownerOptions?: SelectOption[]
  redirectAfterDelete?: string
}

export function ClanActions({
  clan,
  counts,
  variant,
  ownerOptions,
  redirectAfterDelete,
}: ClanActionsProps) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const router = useRouter()

  return (
    <EntityActions
      subject={clan.name}
      noun="clan"
      variant={variant}
      onEdit={() => setDialog("edit")}
      onDelete={() => setDialog("delete")}
    >
      <AdminEditDialog
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        title="Edit clan"
        description={`Update details for ${clan.name}.`}
      >
        <ClanEditForm clan={clan} ownerOptions={ownerOptions} />
      </AdminEditDialog>
      <ConfirmDestructiveDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title="Delete clan"
        description={`Permanently delete the clan ${clan.name}.`}
        confirmText={clan.name}
        impact={clanDeleteImpact(counts)}
        confirmLabel="Delete clan"
        successTitle="Clan deleted"
        successDescription={`${clan.name} was permanently deleted.`}
        onConfirm={() =>
          runAdminAction(
            () => deleteClan(clan.id),
            "Could not delete the clan."
          )
        }
        onSuccess={() => {
          if (redirectAfterDelete) router.push(redirectAfterDelete)
        }}
      />
    </EntityActions>
  )
}

function ClanEditForm({
  clan,
  ownerOptions,
}: {
  clan: ClanActionsClan
  ownerOptions?: SelectOption[]
}) {
  const { pending, setPending, close } = useEditDialog()
  const { toast } = useToast()
  const [name, setName] = useState(clan.name)
  const [description, setDescription] = useState(clan.description ?? "")
  // `null` means "no owner". It is stored as a real NULL, never a placeholder id.
  const [ownerId, setOwnerId] = useState<string | null>(clan.ownerId)
  const [errors, setErrors] = useState<{ name?: string; description?: string }>(
    {}
  )
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = "Clan name is required."
    else if (name.trim().length > 255)
      next.name = "Name must be 255 characters or fewer."
    if (description.length > 1000) {
      next.description = "Description must be 1000 characters or fewer."
    }
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return

    setPending(true)
    const result = await runAdminAction(
      () =>
        updateClan(clan.id, {
          name: name.trim(),
          description: description.trim() || null,
          ...(ownerOptions ? { ownerId } : {}),
        }),
      "Could not update the clan. Nothing was changed."
    )
    setPending(false)

    if (!result.success) {
      setFormError(result.error ?? null)
      toast({
        title: "Could not update clan",
        description: result.error,
        variant: "destructive",
      })
      return
    }
    toast({ title: "Clan updated", description: "Changes were saved." })
    close()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormField label="Clan name" required error={errors.name}>
        {(props) => (
          <Input
            {...props}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label="Description" error={errors.description}>
        {(props) => (
          <Textarea
            {...props}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            disabled={pending}
          />
        )}
      </FormField>
      {ownerOptions ? (
        <FormField
          label="Owner"
          hint="Choose from the clan's members. Clans without an owner can only be managed by admins."
        >
          {(props) => (
            <AdminCombobox
              {...props}
              value={ownerId}
              onChange={setOwnerId}
              options={ownerOptions}
              emptyLabel="No owner"
              placeholder="Select owner"
              searchPlaceholder="Search members…"
              disabled={pending}
            />
          )}
        </FormField>
      ) : (
        <p className="text-muted-foreground text-xs">
          To change the owner, open the clan page.
        </p>
      )}
      <FormError message={formError} />
      <EditDialogFooter submitLabel="Save changes" pendingLabel="Saving…" />
    </form>
  )
}

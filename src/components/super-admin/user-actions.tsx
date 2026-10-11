"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { deleteUser, updateUser } from "@/app/actions/super-admin"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { userConfirmText, userLabel } from "@/lib/super-admin-format"
import {
  userDeleteImpact,
  type UserImpactCounts,
} from "@/lib/super-admin-impact"
import {
  AdminEditDialog,
  EditDialogFooter,
  useEditDialog,
} from "./admin-edit-dialog"
import { FormError, FormField } from "./admin-form-field"
import { ConfirmDestructiveDialog } from "./confirm-destructive-dialog"
import { EntityActions } from "./entity-actions"
import { runAdminAction } from "./run-admin-action"

export interface UserActionsUser {
  id: string
  name: string | null
  email: string | null
  runescapeName: string | null
}

interface UserActionsProps {
  user: UserActionsUser
  counts: UserImpactCounts
  variant: "menu" | "buttons"
  /** Where to go after deleting (detail page -> list). Lists just refresh. */
  redirectAfterDelete?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function UserActions({
  user,
  counts,
  variant,
  redirectAfterDelete,
}: UserActionsProps) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const router = useRouter()
  const label = userLabel(user)

  return (
    <EntityActions
      subject={label}
      noun="user"
      variant={variant}
      onEdit={() => setDialog("edit")}
      onDelete={() => setDialog("delete")}
    >
      <AdminEditDialog
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        title="Edit user"
        description={`Update profile details for ${label}.`}
      >
        <UserEditForm user={user} />
      </AdminEditDialog>
      <ConfirmDestructiveDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title="Delete user"
        description={`Permanently delete ${label}. Read what else is removed before you confirm.`}
        confirmText={userConfirmText(user)}
        impact={userDeleteImpact(counts)}
        confirmLabel="Delete user"
        successTitle="User deleted"
        successDescription={`${label} was permanently deleted.`}
        onConfirm={() =>
          runAdminAction(
            () => deleteUser(user.id),
            "Could not delete the user."
          )
        }
        onSuccess={() => {
          if (redirectAfterDelete) router.push(redirectAfterDelete)
        }}
      />
    </EntityActions>
  )
}

function UserEditForm({ user }: { user: UserActionsUser }) {
  const { pending, setPending, close } = useEditDialog()
  const { toast } = useToast()
  const [name, setName] = useState(user.name ?? "")
  const [email, setEmail] = useState(user.email ?? "")
  const [runescapeName, setRunescapeName] = useState(user.runescapeName ?? "")
  const [errors, setErrors] = useState<{ email?: string; name?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (name.length > 255) next.name = "Name must be 255 characters or fewer."
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      next.email = "Enter a valid email address, or leave it empty."
    }
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return

    setPending(true)
    const result = await runAdminAction(
      () =>
        updateUser(user.id, {
          name: name.trim() || null,
          email: email.trim() || null,
          runescapeName: runescapeName.trim() || null,
        }),
      "Could not update the user. Nothing was changed."
    )
    setPending(false)

    if (!result.success) {
      setFormError(result.error ?? null)
      toast({
        title: "Could not update user",
        description: result.error,
        variant: "destructive",
      })
      return
    }
    toast({ title: "User updated", description: "Changes were saved." })
    close()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormField label="Name" error={errors.name}>
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
      <FormField
        label="Email"
        error={errors.email}
        hint="Super admin access is matched on this address, so addresses on the super-admin list cannot be changed here or given to another user."
      >
        {(props) => (
          <Input
            {...props}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label="RuneScape name">
        {(props) => (
          <Input
            {...props}
            value={runescapeName}
            onChange={(event) => setRunescapeName(event.target.value)}
            disabled={pending}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormError message={formError} />
      <EditDialogFooter submitLabel="Save changes" pendingLabel="Saving…" />
    </form>
  )
}

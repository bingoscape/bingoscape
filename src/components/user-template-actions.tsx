"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Link2, MoreVertical, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
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
import { Spinner } from "@/components/ui/spinner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/components/responsive-dialog"
import {
  TemplateDetailsFields,
  templateDetailsFromRecord,
  toTemplateInput,
  type TemplateDetailsValue,
} from "@/components/template-details-fields"
import { deleteTemplate, updateTemplate } from "@/app/actions/templates"
import { toast } from "@/hooks/use-toast"
import { templateDetailsSchema } from "@/lib/template-input"

/** The editable part of a template. */
export interface EditableTemplate {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string[]
  isPublic: boolean
}

interface EditTemplateDialogProps {
  template: EditableTemplate
  categorySuggestions: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Edit a template's details. The board itself can't be edited. */
export function EditTemplateDialog({
  template,
  categorySuggestions,
  open,
  onOpenChange,
}: EditTemplateDialogProps) {
  const [pending, setPending] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit template details</DialogTitle>
          <DialogDescription>
            Changes apply right away. To change the board itself, save a new
            template from the updated board.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form always starts from the
            template's current values. */}
        <EditTemplateForm
          template={template}
          categorySuggestions={categorySuggestions}
          pending={pending}
          setPending={setPending}
          onDone={() => onOpenChange(false)}
        />
      </ResponsiveDialogContent>
    </Dialog>
  )
}

function EditTemplateForm({
  template,
  categorySuggestions,
  pending,
  setPending,
  onDone,
}: {
  template: EditableTemplate
  categorySuggestions: string[]
  pending: boolean
  setPending: (pending: boolean) => void
  onDone: () => void
}) {
  const router = useRouter()
  const [details, setDetails] = useState<TemplateDetailsValue>(() =>
    templateDetailsFromRecord(template)
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const input = toTemplateInput(details)
    const validation = templateDetailsSchema.safeParse(input)
    if (!validation.success) {
      toast({
        title: "Check the template details",
        description: validation.error.issues[0]?.message,
        variant: "destructive",
      })
      return
    }

    setPending(true)
    try {
      const result = await updateTemplate(template.id, input)
      if (!result.success) {
        throw new Error(result.error ?? "Failed to update template")
      }
      toast({ title: "Template updated" })
      onDone()
      router.refresh()
    } catch (error) {
      toast({
        title: "Couldn't update the template",
        description:
          error instanceof Error ? error.message : "Failed to update template",
        variant: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <ResponsiveDialogBody>
        <TemplateDetailsFields
          idPrefix={`edit-template-${template.id}`}
          value={details}
          onChange={setDetails}
          categorySuggestions={categorySuggestions}
          disabled={pending}
        />
      </ResponsiveDialogBody>
      <ResponsiveDialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  )
}

interface DeleteTemplateDialogProps {
  template: Pick<EditableTemplate, "id" | "title">
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where to go afterwards. Defaults to refreshing the current page. */
  redirectTo?: string
}

export function DeleteTemplateDialog({
  template,
  open,
  onOpenChange,
  redirectTo,
}: DeleteTemplateDialogProps) {
  const router = useRouter()

  const handleDelete = async () => {
    try {
      const result = await deleteTemplate(template.id)
      if (!result.success) {
        throw new Error(result.error ?? "Failed to delete template")
      }
      toast({ title: "Template deleted" })
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } catch (error) {
      toast({
        title: "Couldn't delete the template",
        description:
          error instanceof Error ? error.message : "Failed to delete template",
        variant: "destructive",
      })
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this template?"
      description={
        <>
          <span className="font-medium">{template.title}</span> will be removed
          from the gallery for good. Boards already created from it are not
          affected.
        </>
      }
      confirmLabel="Delete template"
      pendingLabel="Deleting…"
      variant="destructive"
      onConfirm={handleDelete}
    />
  )
}

interface UserTemplateActionsProps {
  template: EditableTemplate
  categorySuggestions: string[]
}

/** Overflow menu on "My templates" cards. Sits above the card's stretched link. */
export function UserTemplateActions({
  template,
  categorySuggestions,
}: UserTemplateActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/templates/${template.id}`
      )
      toast({
        title: "Link copied",
        description: template.isPublic
          ? undefined
          : "It only opens for you while the template is private.",
      })
    } catch {
      toast({
        title: "Couldn't copy the link",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical aria-hidden="true" />
            <span className="sr-only">Actions for {template.title}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={`/templates/${template.id}`}>
              <Eye aria-hidden="true" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            onSelect={() => setEditOpen(true)}
          >
            <Pencil aria-hidden="true" />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            onSelect={() => void copyLink()}
          >
            <Link2 aria-hidden="true" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-danger focus:text-danger min-h-11"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditTemplateDialog
        template={template}
        categorySuggestions={categorySuggestions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteTemplateDialog
        template={template}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

interface TemplateOwnerButtonsProps {
  template: EditableTemplate
  categorySuggestions: string[]
}

/** Edit and Delete buttons for the detail page header (owner only). */
export function TemplateOwnerButtons({
  template,
  categorySuggestions,
}: TemplateOwnerButtonsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil aria-hidden="true" />
        Edit
      </Button>
      <Button variant="outline" onClick={() => setDeleteOpen(true)}>
        <Trash2 aria-hidden="true" />
        Delete
      </Button>
      <EditTemplateDialog
        template={template}
        categorySuggestions={categorySuggestions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteTemplateDialog
        template={template}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        redirectTo="/templates/my-templates"
      />
    </>
  )
}

"use client"

import type React from "react"
import { Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RowActionsMenu, type RowAction } from "./row-actions-menu"

interface EntityActionsProps {
  /** Row / entity name, used for the menu's accessible name and button names. */
  subject: string
  noun: string
  variant: "menu" | "buttons"
  onEdit: () => void
  onDelete: () => void
  /** Rendered after the trigger: the dialogs this component opens. */
  children?: React.ReactNode
}

/**
 * Edit + Delete controls for one entity: an overflow menu in tables, two
 * labelled buttons in detail-page headers. Keeps every user/clan/event list
 * and header on the same interaction.
 */
export function EntityActions({
  subject,
  noun,
  variant,
  onEdit,
  onDelete,
  children,
}: EntityActionsProps) {
  const actions: RowAction[] = [
    { key: "edit", label: `Edit ${noun}`, icon: Pencil, onSelect: onEdit },
    {
      key: "delete",
      label: `Delete ${noun}`,
      icon: Trash2,
      onSelect: onDelete,
      destructive: true,
    },
  ]

  return (
    <>
      {variant === "menu" ? (
        <RowActionsMenu subject={subject} actions={actions} />
      ) : (
        <>
          <Button variant="outline" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            Edit {noun}
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            Delete {noun}
          </Button>
        </>
      )}
      {children}
    </>
  )
}

"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { ScrollText, Pencil, Trash2, Plus, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  createEventRule,
  updateEventRule,
  deleteEventRule,
} from "@/app/actions/events"
import type { EventRule } from "@/app/actions/events"

interface EventRulesSheetProps {
  eventId: string
  initialRules: EventRule[]
  isAdmin: boolean
}

export function EventRulesSheet({
  eventId,
  initialRules,
  isAdmin,
}: EventRulesSheetProps) {
  const [open, setOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [rules, setRules] = useState<EventRule[]>(initialRules)
  const [newRuleText, setNewRuleText] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState("")
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()
  const newRuleInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Keep local rules in sync when the sheet is re-opened with fresh props
  useEffect(() => {
    setRules(initialRules)
  }, [initialRules])

  // Focus the edit input whenever editing starts on a rule
  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  const hasRules = rules.length > 0

  // Don't render the button at all for non-admins when there are no rules
  if (!isAdmin && !hasRules) return null

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value) {
      // Reset editing state when the sheet closes
      setIsEditing(false)
      setEditingId(null)
      setNewRuleText("")
    }
  }

  function startEditing(rule: EventRule) {
    setEditingId(rule.id)
    setEditingText(rule.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingText("")
  }

  function handleAdd() {
    const text = newRuleText.trim()
    if (!text) return

    startTransition(async () => {
      const result = await createEventRule(eventId, text)
      if (result.success && result.rule) {
        setRules((prev) => [...prev, result.rule!])
        setNewRuleText("")
        router.refresh()
        newRuleInputRef.current?.focus()
      } else {
        toast({
          title: "Failed to add rule",
          description: result.error,
          variant: "destructive",
        })
      }
    })
  }

  function handleUpdate(ruleId: string) {
    const text = editingText.trim()
    if (!text) return

    startTransition(async () => {
      const result = await updateEventRule(ruleId, eventId, text)
      if (result.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, content: text } : r))
        )
        setEditingId(null)
        router.refresh()
      } else {
        toast({
          title: "Failed to update rule",
          description: result.error,
          variant: "destructive",
        })
      }
    })
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      const result = await deleteEventRule(ruleId, eventId)
      if (result.success) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId))
        router.refresh()
      } else {
        toast({
          title: "Failed to delete rule",
          description: result.error,
          variant: "destructive",
        })
      }
    })
  }

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <ScrollText className="h-4 w-4" />
        <span>Rules</span>
        {hasRules && (
          <Badge
            variant="secondary"
            className="ml-0.5 h-5 min-w-5 px-1 text-xs"
          >
            {rules.length}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
          {/* Header */}
          <SheetHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between pr-6">
              <SheetTitle className="text-base">
                {isEditing ? "Edit Rules" : "Event Rules"}
              </SheetTitle>
              {isAdmin && !isEditing && hasRules && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => {
                    setIsEditing(true)
                    setTimeout(() => newRuleInputRef.current?.focus(), 50)
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
            <SheetDescription className="text-xs">
              {isEditing
                ? "Add, edit, or remove rules for this event."
                : "Guidelines that apply to all participants."}
            </SheetDescription>
          </SheetHeader>

          {/* Rules list */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {rules.length === 0 && !isEditing ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
                <ScrollText className="h-8 w-8 opacity-40" />
                <p className="text-sm">
                  No rules have been set for this event.
                </p>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 gap-1.5"
                    onClick={() => setIsEditing(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add the first rule
                  </Button>
                )}
              </div>
            ) : (
              <ol className="space-y-2">
                {rules.map((rule, index) => (
                  <li
                    key={rule.id}
                    className="flex items-start gap-3 rounded-md border bg-muted/30 px-3 py-2.5 text-sm"
                  >
                    <span className="mt-0.5 min-w-[1.25rem] text-right font-mono text-xs font-medium text-muted-foreground">
                      {index + 1}.
                    </span>

                    {isEditing && editingId === rule.id ? (
                      /* Inline edit input */
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          ref={editInputRef}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="h-7 flex-1 text-sm"
                          maxLength={500}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdate(rule.id)
                            if (e.key === "Escape") cancelEdit()
                          }}
                          disabled={isPending}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700"
                          onClick={() => handleUpdate(rule.id)}
                          disabled={isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={cancelEdit}
                          disabled={isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      /* Read row */
                      <div className="flex flex-1 items-start justify-between gap-2">
                        <span className="leading-snug">{rule.content}</span>
                        {isEditing && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => startEditing(rule)}
                              disabled={isPending}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(rule.id)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Edit mode footer */}
          {isEditing && (
            <div className="space-y-3 border-t px-6 py-4">
              <div className="flex gap-2">
                <Input
                  ref={newRuleInputRef}
                  placeholder="New rule..."
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  maxLength={500}
                  className="flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd()
                  }}
                  disabled={isPending}
                />
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={isPending || !newRuleText.trim()}
                  className="shrink-0 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setIsEditing(false)
                  setEditingId(null)
                  setNewRuleText("")
                }}
                disabled={isPending}
              >
                Done
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

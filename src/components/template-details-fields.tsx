"use client"

import { useState, type KeyboardEvent, type ReactNode } from "react"
import { Eye, EyeOff, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import {
  TEMPLATE_CATEGORY_MAX,
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_TAGS_MAX,
  TEMPLATE_TAG_MAX_LENGTH,
  TEMPLATE_TITLE_MAX,
  parseTags,
  serializeTags,
} from "@/lib/template-input"

export interface TemplateDetailsValue {
  title: string
  description: string
  category: string
  tags: string[]
  isPublic: boolean
}

/** Server action input shape (`tags` is stored as a comma separated string). */
export function toTemplateInput(value: TemplateDetailsValue) {
  return {
    title: value.title,
    description: value.description,
    category: value.category,
    tags: serializeTags(value.tags),
    isPublic: value.isPublic,
  }
}

export function templateDetailsFromRecord(record: {
  title: string
  description: string | null
  category: string | null
  tags: string[]
  isPublic: boolean
}): TemplateDetailsValue {
  return {
    title: record.title,
    description: record.description ?? "",
    category: record.category ?? "",
    tags: record.tags,
    isPublic: record.isPublic,
  }
}

interface TemplateDetailsFieldsProps {
  /** Prefix for element ids, unique per dialog on the page. */
  idPrefix: string
  value: TemplateDetailsValue
  onChange: (value: TemplateDetailsValue) => void
  categorySuggestions: string[]
  disabled?: boolean
  /** Focus the title when the fields mount (e.g. on entering a dialog step). */
  autoFocusTitle?: boolean
}

const MAX_SUGGESTIONS = 6

/**
 * Title, description, category, tags and visibility. Used by the create dialog
 * (step 2) and the edit dialog so both enforce the same limits.
 */
export function TemplateDetailsFields({
  idPrefix,
  value,
  onChange,
  categorySuggestions,
  disabled = false,
  autoFocusTitle = false,
}: TemplateDetailsFieldsProps) {
  const [tagDraft, setTagDraft] = useState("")

  const set = (patch: Partial<TemplateDetailsValue>) =>
    onChange({ ...value, ...patch })

  const commitTag = () => {
    const additions = parseTags(tagDraft)
    setTagDraft("")
    if (additions.length === 0) return
    set({
      tags: parseTags([...value.tags, ...additions].join(",")).slice(
        0,
        TEMPLATE_TAGS_MAX
      ),
    })
  }

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      // Enter must add the tag, not submit the surrounding form.
      event.preventDefault()
      commitTag()
    } else if (
      event.key === "Backspace" &&
      tagDraft === "" &&
      value.tags.length > 0
    ) {
      set({ tags: value.tags.slice(0, -1) })
    }
  }

  const typed = value.category.trim().toLowerCase()
  const suggestions = categorySuggestions
    .filter((category) => {
      const lower = category.toLowerCase()
      return lower !== typed && (typed === "" || lower.includes(typed))
    })
    .slice(0, MAX_SUGGESTIONS)

  const tagsFull = value.tags.length >= TEMPLATE_TAGS_MAX

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`${idPrefix}-title`}>Title</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {value.title.length}/{TEMPLATE_TITLE_MAX}
          </span>
        </div>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          maxLength={TEMPLATE_TITLE_MAX}
          autoFocus={autoFocusTitle}
          required
          disabled={disabled}
          onChange={(event) => set({ title: event.target.value })}
          placeholder="e.g. Chambers of Xeric 5×5"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`${idPrefix}-description`}>Description</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {value.description.length}/{TEMPLATE_DESCRIPTION_MAX}
          </span>
        </div>
        <Textarea
          id={`${idPrefix}-description`}
          value={value.description}
          maxLength={TEMPLATE_DESCRIPTION_MAX}
          rows={3}
          disabled={disabled}
          onChange={(event) => set({ description: event.target.value })}
          placeholder="Who is this board for, and what makes it fun?"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Input
          id={`${idPrefix}-category`}
          value={value.category}
          maxLength={TEMPLATE_CATEGORY_MAX}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => set({ category: event.target.value })}
          placeholder="e.g. PvM, Skilling, Questing"
        />
        {suggestions.length > 0 ? (
          <div
            role="group"
            aria-label="Suggested categories"
            className="flex flex-wrap gap-2"
          >
            {suggestions.map((category) => (
              <Button
                key={category}
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => set({ category })}
              >
                {category}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`${idPrefix}-tags`}>Tags</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {value.tags.length} of {TEMPLATE_TAGS_MAX}
          </span>
        </div>
        {value.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Current tags">
            {value.tags.map((tag) => (
              <li
                key={tag}
                className="osrs-slot flex items-center gap-1 rounded-sm pl-2 text-sm"
              >
                {tag}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove tag ${tag}`}
                  onClick={() =>
                    set({ tags: value.tags.filter((t) => t !== tag) })
                  }
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-8 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-hidden pointer-coarse:size-11"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2">
          <Input
            id={`${idPrefix}-tags`}
            value={tagDraft}
            maxLength={TEMPLATE_TAG_MAX_LENGTH}
            disabled={disabled || tagsFull}
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby={`${idPrefix}-tags-hint`}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={commitTag}
            placeholder={
              tagsFull ? "Tag limit reached" : "e.g. boss, raids, ironman"
            }
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled || tagsFull || tagDraft.trim() === ""}
            onClick={commitTag}
          >
            <Plus aria-hidden="true" />
            <span className="sr-only">Add tag</span>
          </Button>
        </div>
        <p
          id={`${idPrefix}-tags-hint`}
          className="text-muted-foreground text-xs"
        >
          Press Enter or comma to add a tag. Up to {TEMPLATE_TAGS_MAX}.
        </p>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="mb-2 text-sm leading-none font-medium">
          Visibility
        </legend>
        <RadioGroup
          value={value.isPublic ? "public" : "private"}
          onValueChange={(next) => set({ isPublic: next === "public" })}
        >
          <VisibilityOption
            id={`${idPrefix}-public`}
            value="public"
            icon={<Eye aria-hidden="true" className="size-4" />}
            title="Public"
            description="Everyone signed in can find, preview and use it. Hidden tiles show as ??? in the preview, but whoever uses the template gets the full board."
          />
          <VisibilityOption
            id={`${idPrefix}-private`}
            value="private"
            icon={<EyeOff aria-hidden="true" className="size-4" />}
            title="Private"
            description="Only you can see and use it. Switch to public any time."
          />
        </RadioGroup>
      </fieldset>
    </>
  )
}

function VisibilityOption({
  id,
  value,
  icon,
  title,
  description,
}: {
  id: string
  value: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <label
      htmlFor={id}
      className="osrs-slot has-[:focus-visible]:ring-ring has-[[data-state=checked]]:border-primary flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border border-transparent p-3 has-[:focus-visible]:ring-2"
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="space-y-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </span>
        <span className="text-muted-foreground block text-xs">
          {description}
        </span>
      </span>
    </label>
  )
}

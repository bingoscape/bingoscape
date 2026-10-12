"use client"

import { useId, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getItemDisplayName } from "@/components/osrs-item-option"
import { resolveOsrsItemNames } from "@/app/actions/osrs-items"
import {
  MAX_ITEM_NAME_LENGTH,
  MAX_LIST_ENTRIES,
  parseItemList,
} from "@/lib/item-list-parse"
import { parseTargetInput, validateNumberInput } from "@/lib/number-input"
import type { OsrsItem } from "@/types/osrs-items"
import { PasteReviewRow, rowState, type PasteRow } from "./paste-review-row"
import type { QuantifiedItem } from "./selected-items"

/** Longest text the box takes; far more than 100 lines of item names. */
const MAX_PASTE_LENGTH = 20_000

const PLACEHOLDER = "Abyssal whip\n3x Dragon bones\nTwisted bow"

type Phase = "input" | "resolving" | "review"

interface PasteListPanelProps {
  /** The reviewed items, to put into the selection. Nothing is created by pasting. */
  onConfirm: (items: QuantifiedItem[]) => void
  /** Closes the panel and drops the pasted list. */
  onCancel: () => void
  /** Search the normal item search for this text, for a line that was not found. */
  onSearchInstead: (text: string) => void
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

/** "12 matched, 2 need a choice, 1 not found"; parts that are zero are left out. */
export function summarizeRows(rows: PasteRow[]): string {
  const states = rows.map(rowState)
  const count = (state: string) => states.filter((s) => s === state).length
  const choose = count("choose")
  const parts = [
    count("ready") > 0 ? `${count("ready")} matched` : null,
    choose > 0 ? `${choose} ${choose === 1 ? "needs" : "need"} a choice` : null,
    count("notFound") > 0 ? `${count("notFound")} not found` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "Nothing left in the list"
}

/**
 * Paste a list of items (one per line, with optional quantities), review how
 * each line was matched, then move the resolved ones into the selection.
 * Three phases: type or paste the text, wait while the server matches the
 * names, review. The server only reads (`resolveOsrsItemNames`); nothing is
 * created until the selection is added as goals.
 *
 * Escape steps back instead of closing the drawer: review returns to the
 * text, the text is cleared, an empty box closes the panel.
 */
export function PasteListPanel({
  onConfirm,
  onCancel,
  onSearchInstead,
}: PasteListPanelProps) {
  const ids = useId()
  const [phase, setPhase] = useState<Phase>("input")
  const [text, setText] = useState("")
  const [rows, setRows] = useState<PasteRow[]>([])
  const [ignored, setIgnored] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Only the latest request may fill the review; Escape and edits supersede it.
  const requestRef = useRef(0)
  const nextRowId = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const parsed = useMemo(() => parseItemList(text), [text])
  const entryCount = parsed.entries.length

  const startReview = async () => {
    if (entryCount === 0 || phase === "resolving") return
    const request = ++requestRef.current
    const { entries } = parsed
    setPhase("resolving")
    setError(null)
    try {
      const result = await resolveOsrsItemNames(
        entries.map(({ name, quantity, alternatives }) => ({
          name,
          quantity,
          ...(alternatives.length > 0 ? { alternatives } : {}),
        }))
      )
      if (request !== requestRef.current) return
      if (!result.success || result.results.length !== entries.length) {
        setError(result.error ?? "Could not match your list. Try again.")
        setPhase("input")
        return
      }
      setRows(
        result.results.map((resolved, index) => ({
          id: nextRowId.current++,
          raw: entries[index]?.raw ?? resolved.input,
          name: resolved.input,
          quantity: String(resolved.quantity),
          item: resolved.status === "matched" ? (resolved.item ?? null) : null,
          candidates:
            resolved.status === "ambiguous" ? (resolved.candidates ?? []) : [],
        }))
      )
      setIgnored(parsed.ignored)
      setPhase("review")
    } catch (caught) {
      if (request !== requestRef.current) return
      console.error("Error matching pasted items:", caught)
      setError(
        "Could not match your list. Check your connection and try again."
      )
      setPhase("input")
    }
  }

  const backToText = () => {
    requestRef.current++
    setPhase("input")
  }

  const updateRow = (id: number, change: Partial<PasteRow>) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...change } : row))
    )

  const removeRow = (id: number) => {
    setRows((current) => current.filter((row) => row.id !== id))
    // The removed row's buttons are gone; keep the place for keyboard users.
    headingRef.current?.focus()
  }

  const ready = rows.filter((row) => rowState(row) === "ready")
  const needChoice = rows.filter((row) => rowState(row) === "choose")
  const notFound = rows.length - ready.length - needChoice.length

  /** Why the review cannot be confirmed yet, or null. */
  const blockReason = ((): string | null => {
    if (needChoice.length > 0) {
      const n = needChoice.length
      return `Choose an item for ${plural(n, "line", "lines")}, or remove ${n === 1 ? "it" : "them"}.`
    }
    for (const row of ready) {
      const problem = validateNumberInput(row.quantity)
      if (problem && row.item) {
        return `Quantity for ${getItemDisplayName(row.item)}: ${problem}`
      }
    }
    return ready.length === 0 ? "There is nothing to add yet." : null
  })()

  const confirm = () => {
    if (blockReason) return
    const items: QuantifiedItem[] = []
    for (const row of ready) {
      const quantity = parseTargetInput(row.quantity)
      if (row.item && quantity !== null)
        items.push({ item: row.item, quantity })
    }
    onConfirm(items)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      // The panel sits inside the drawer's form; Enter in a quantity must not add the goals.
      event.preventDefault()
    }
    if (event.key !== "Escape") return
    // The drawer ignores Escape in here (data-escape-guard): step back instead.
    event.stopPropagation()
    if (phase !== "input") backToText()
    else if (text !== "") setText("")
    else onCancel()
  }

  const textId = `${ids}-text`
  const hintId = `${ids}-hint`
  const countId = `${ids}-count`
  const reasonId = `${ids}-reason`
  const resolving = phase === "resolving"

  return (
    <section
      id={`${ids}-panel`}
      aria-labelledby={`${ids}-heading`}
      data-escape-guard=""
      onKeyDown={handleKeyDown}
      className="bg-muted/30 space-y-3 rounded-lg border p-3"
    >
      <h3
        id={`${ids}-heading`}
        ref={headingRef}
        tabIndex={-1}
        className="text-sm font-semibold outline-hidden"
      >
        {phase === "review" ? "Review your list" : "Paste a list"}
      </h3>

      {phase !== "review" && (
        <div className="space-y-1.5">
          <Label htmlFor={textId} className="text-sm font-medium">
            One item per line
          </Label>
          <p id={hintId} className="text-muted-foreground text-xs">
            Add a quantity like 3x Dragon bones, Dragon bones x3 or Dragon bones
            (3). Shorthand such as 1k works too.
          </p>
          <Textarea
            id={textId}
            autoFocus
            rows={6}
            maxLength={MAX_PASTE_LENGTH}
            value={text}
            disabled={resolving}
            onChange={(event) => setText(event.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            autoComplete="off"
            aria-describedby={`${hintId} ${countId}`}
          />
          <p id={countId} className="text-muted-foreground min-h-4 text-xs">
            {[
              entryCount > 0
                ? `${plural(entryCount, "item", "items")} found`
                : "",
              parsed.ignored > 0
                ? `${parsed.ignored} ignored (up to ${MAX_LIST_ENTRIES} items, names up to ${MAX_ITEM_NAME_LENGTH} characters)`
                : "",
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      )}

      <div role="status" aria-live="polite">
        {resolving && (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            />
            {`Matching ${plural(entryCount, "item", "items")}...`}
          </p>
        )}
        {phase === "review" && (
          <p className="text-foreground text-sm font-medium">
            {summarizeRows(rows)}
            {ignored > 0 && (
              <span className="text-muted-foreground block text-xs font-normal">
                {ignored} {ignored === 1 ? "line was" : "lines were"} ignored: a
                list holds up to {MAX_LIST_ENTRIES} items.
              </span>
            )}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}

      {/* Above the list, so confirming never needs a scroll past it. */}
      <div className="flex flex-wrap gap-2">
        {phase === "review" ? (
          <>
            <Button
              type="button"
              disabled={blockReason !== null}
              aria-describedby={blockReason ? reasonId : undefined}
              onClick={confirm}
              className="flex-1"
            >
              {`Add ${plural(ready.length, "item", "items")} to selection`}
            </Button>
            <Button type="button" variant="outline" onClick={backToText}>
              Edit list
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={entryCount === 0 || resolving}
            onClick={startReview}
            className="flex-1"
          >
            {resolving ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                />
                Matching...
              </>
            ) : (
              "Review list"
            )}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {phase === "review" && (blockReason || notFound > 0) && (
        <p id={reasonId} className="text-muted-foreground -mt-1 text-xs">
          {blockReason ??
            `${plural(notFound, "line", "lines")} not found will be skipped.`}
        </p>
      )}

      {phase === "review" && rows.length > 0 && (
        // Bounded so the rest of the drawer stays reachable; scrolls on its own.
        <ul
          aria-label="Pasted items"
          className="max-h-[min(22rem,45dvh)] space-y-2 overflow-y-auto overscroll-contain pr-0.5"
        >
          {rows.map((row) => (
            <PasteReviewRow
              key={row.id}
              row={row}
              onQuantityChange={(quantity) => updateRow(row.id, { quantity })}
              onChoose={(item: OsrsItem) => updateRow(row.id, { item })}
              onRemove={() => removeRow(row.id)}
              onSearchInstead={() => onSearchInstead(row.name)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

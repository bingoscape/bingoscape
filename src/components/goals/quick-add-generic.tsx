"use client"

import { useId, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validateDescription } from "@/lib/goal-validation"
import { parseTargetInput } from "@/lib/number-input"
import { buildGenericGoalInput, formatAddedGoal } from "./goal-inputs"
import { NumberField } from "./number-field"
import {
  InlineError,
  QuickAddButton,
  type QuickAddFormProps,
} from "./quick-add-shared"

/** A free-text task with a target: describe it, set how often, Enter. */
export function QuickAddGeneric({ onAdd, announce }: QuickAddFormProps) {
  const ids = useId()
  const descriptionId = `${ids}-description`
  const descriptionErrorId = `${ids}-description-error`
  const [description, setDescription] = useState("")
  const [target, setTarget] = useState("1")
  const [attempted, setAttempted] = useState(false)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<HTMLInputElement>(null)

  const descriptionError = validateDescription(description)
  const showDescriptionError = attempted && descriptionError !== null

  const submit = () => {
    if (descriptionError) {
      setAttempted(true)
      descriptionRef.current?.focus()
      return
    }
    const targetValue = parseTargetInput(target)
    if (targetValue === null) {
      setAttempted(true)
      targetRef.current?.focus()
      return
    }

    const input = buildGenericGoalInput(description, targetValue)
    const previous = { description, target }
    setDescription("")
    setTarget("1")
    setAttempted(false)
    descriptionRef.current?.focus()

    void onAdd(input).then((result) => {
      if (result.success) {
        announce(`Added ${formatAddedGoal(input)}`)
        return
      }
      // Put back what was typed, unless the user already started the next one.
      setDescription((current) => current || previous.description)
      setTarget((current) => (current === "1" ? previous.target : current))
    })
  }

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        // Keep the submit from reaching a form further up the React tree.
        event.stopPropagation()
        submit()
      }}
    >
      <div data-quick-add-primary="" className="space-y-1.5">
        <Label htmlFor={descriptionId} className="text-xs">
          Description
        </Label>
        <Input
          ref={descriptionRef}
          id={descriptionId}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Complete the task..."
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={showDescriptionError}
          aria-describedby={
            showDescriptionError ? descriptionErrorId : undefined
          }
          className="h-9 pointer-coarse:h-11"
        />
        {showDescriptionError && (
          <InlineError id={descriptionErrorId}>{descriptionError}</InlineError>
        )}
      </div>
      <NumberField
        id={`${ids}-target`}
        inputRef={targetRef}
        compact
        label="Target"
        value={target}
        onValueChange={setTarget}
        placeholder="1"
        forceShowError={attempted}
        action={<QuickAddButton label="Add goal" />}
      />
    </form>
  )
}

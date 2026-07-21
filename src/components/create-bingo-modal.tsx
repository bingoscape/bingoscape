"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBingo } from "@/app/actions/bingo"
import { Textarea } from "@/components/ui/textarea"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Checkbox } from "@/components/ui/checkbox"
import generateOSRSCodePhrase from "@/lib/codephraseGenerator"
import { PatternBonusSchematicEditor } from "./pattern-bonus-schematic-editor"
import {
  ArrowLeft,
  ArrowRight,
  Dices,
  Grid3X3,
  ArrowUpRight,
  PlusCircle,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CreateBingoModalProps {
  eventId: string
  isOpen: boolean
  onClose: () => void
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 20 : -20,
    opacity: 0,
  }),
}

export function CreateBingoModal({
  eventId,
  isOpen,
  onClose,
}: CreateBingoModalProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const totalSteps = 4

  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [codephrase, setCodephrase] = useState("")
  const [inheritEventStart, setInheritEventStart] = useState(true)
  const [scheduledUnlockDate, setScheduledUnlockDate] = useState<
    Date | undefined
  >(undefined)

  // Step 2
  const [bingoType, setBingoType] = useState<"standard" | "progression">(
    "standard"
  )
  const [rows, setRows] = useState(5)
  const [columns, setColumns] = useState(5)
  const [tiersUnlockRequirement, setTiersUnlockRequirement] = useState(5)

  // Step 3
  const [rowBonuses, setRowBonuses] = useState<Record<number, number>>({})
  const [columnBonuses, setColumnBonuses] = useState<Record<number, number>>({})
  const [mainDiagonalBonus, setMainDiagonalBonus] = useState(0)
  const [antiDiagonalBonus, setAntiDiagonalBonus] = useState(0)
  const [completeBoardBonus, setCompleteBoardBonus] = useState(0)

  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCodephrase(generateOSRSCodePhrase())
      setStep(1)
      setDirection(1)
      setTitle("")
      setDescription("")
      setBingoType("standard")
      setRows(5)
      setColumns(5)
      setTiersUnlockRequirement(5)
      setRowBonuses({})
      setColumnBonuses({})
      setMainDiagonalBonus(0)
      setAntiDiagonalBonus(0)
      setCompleteBoardBonus(0)
      setInheritEventStart(true)
      setScheduledUnlockDate(undefined)
      setError(null)
    }
  }, [isOpen])

  const handleNext = () => {
    // Basic validation
    if (step === 1 && !title) {
      setError("Title is required")
      return
    }
    setError(null)
    setDirection(1)
    setStep((prev) => Math.min(prev + 1, totalSteps))
  }

  const handleBack = () => {
    setDirection(-1)
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const rollCodephrase = () => {
    setCodephrase(generateOSRSCodePhrase())
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.append("eventId", eventId)
    formData.append("title", title)
    formData.append("description", description)
    formData.append("codephrase", codephrase)
    formData.append("bingoType", bingoType)
    formData.append("rows", String(rows))
    formData.append("columns", String(columns))

    if (!inheritEventStart && scheduledUnlockDate) {
      formData.append("scheduledUnlockDate", scheduledUnlockDate.toISOString())
    }

    if (bingoType === "progression") {
      formData.append("tiersUnlockRequirement", String(tiersUnlockRequirement))
    } else {
      for (let i = 0; i < rows; i++) {
        formData.append(`rowBonus-${i}`, String(rowBonuses[i] ?? 0))
      }
      for (let i = 0; i < columns; i++) {
        formData.append(`columnBonus-${i}`, String(columnBonuses[i] ?? 0))
      }
      formData.append("mainDiagonalBonus", String(mainDiagonalBonus))
      formData.append("antiDiagonalBonus", String(antiDiagonalBonus))
      formData.append("completeBoardBonus", String(completeBoardBonus))
    }

    try {
      const result = await createBingo(formData)
      if (!result.success) {
        setError(result.error || "Failed to create bingo")
        return
      }
      onClose()
      router.refresh()
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("An unknown error occurred")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create New Bingo Board</DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}:{" "}
            {step === 1
              ? "Board Identity"
              : step === 2
                ? "Format & Dimensions"
                : step === 3
                  ? "Mechanics"
                  : "Review & Create"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="relative my-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "25%" }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="relative min-h-[400px] flex-1">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-0 space-y-6 overflow-y-auto px-1 py-2"
            >
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Board Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codephrase">
                      Secret Codephrase{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="codephrase"
                        value={codephrase}
                        onChange={(e) => setCodephrase(e.target.value)}
                        required
                        className="font-mono text-primary"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={rollCodephrase}
                        title="Generate new codephrase"
                      >
                        <Dices className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used by players to join this specific board or submit
                      tiles.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="resize-none"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Visibility & Unlock
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Configure when this board will become visible and
                        unlocked for participants.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="inheritEventStart"
                        checked={inheritEventStart}
                        onCheckedChange={(checked) =>
                          setInheritEventStart(checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="inheritEventStart"
                        className="cursor-pointer text-sm"
                      >
                        Unlock automatically when the event starts
                      </Label>
                    </div>

                    <AnimatePresence>
                      {!inheritEventStart && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-2">
                            <Label>Scheduled Unlock Time</Label>
                            <DateTimePicker
                              date={scheduledUnlockDate}
                              setDate={setScheduledUnlockDate}
                              placeholder="Select a custom unlock date and time"
                            />
                            <p className="text-xs text-muted-foreground">
                              Uses the same timezone as the event.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Bingo Type</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "group relative cursor-pointer overflow-hidden rounded-xl border-2 p-4 transition-colors",
                          bingoType === "standard"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setBingoType("standard")}
                      >
                        {bingoType === "standard" && (
                          <div className="absolute right-2 top-2 text-primary">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                        )}
                        <Grid3X3
                          className={cn(
                            "mb-3 h-8 w-8",
                            bingoType === "standard"
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                        <h4 className="text-sm font-semibold">
                          Standard Bingo
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Traditional bingo where all tiles are available from
                          the start.
                        </p>
                      </motion.div>

                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "group relative cursor-pointer overflow-hidden rounded-xl border-2 p-4 transition-colors",
                          bingoType === "progression"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setBingoType("progression")}
                      >
                        {bingoType === "progression" && (
                          <div className="absolute right-2 top-2 text-primary">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                        )}
                        <ArrowUpRight
                          className={cn(
                            "mb-3 h-8 w-8",
                            bingoType === "progression"
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                        <h4 className="text-sm font-semibold">
                          Progression Bingo
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Teams unlock tiers progressively. Rows act as tiers.
                        </p>
                      </motion.div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rows">
                        Number of Rows{" "}
                        {bingoType === "progression" && "(Tiers)"}
                      </Label>
                      <Input
                        id="rows"
                        type="number"
                        min="1"
                        max="10"
                        value={rows}
                        onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="columns">Number of Columns</Label>
                      <Input
                        id="columns"
                        type="number"
                        min="1"
                        max="10"
                        value={columns}
                        onChange={(e) =>
                          setColumns(parseInt(e.target.value) || 1)
                        }
                        required
                      />
                    </div>
                  </div>

                  {bingoType === "progression" && (
                    <div className="space-y-2">
                      <Label htmlFor="tiersUnlockRequirement">
                        XP Required to Unlock Next Tier
                      </Label>
                      <Input
                        id="tiersUnlockRequirement"
                        type="number"
                        min="1"
                        value={tiersUnlockRequirement}
                        onChange={(e) =>
                          setTiersUnlockRequirement(
                            parseInt(e.target.value) || 1
                          )
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Amount of XP (weight) that must be earned in each tier
                        before the next tier unlocks.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  {bingoType === "standard" ? (
                    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                      <div>
                        <h3 className="mb-1 text-sm font-semibold">
                          Pattern Bonuses (Optional)
                        </h3>
                        <p className="mb-4 text-xs text-muted-foreground">
                          Award extra XP when teams complete full rows, columns,
                          or diagonals. Hover over inputs to see affected tiles.
                        </p>
                      </div>

                      <div className="overflow-hidden rounded-lg border bg-background p-2 shadow-xs">
                        <PatternBonusSchematicEditor
                          rows={rows}
                          columns={columns}
                          rowBonuses={rowBonuses}
                          columnBonuses={columnBonuses}
                          mainDiagonalBonus={mainDiagonalBonus}
                          antiDiagonalBonus={antiDiagonalBonus}
                          completeBoardBonus={completeBoardBonus}
                          onRowBonusChange={(index, value) =>
                            setRowBonuses((prev) => ({
                              ...prev,
                              [index]: value,
                            }))
                          }
                          onColumnBonusChange={(index, value) =>
                            setColumnBonuses((prev) => ({
                              ...prev,
                              [index]: value,
                            }))
                          }
                          onMainDiagonalChange={setMainDiagonalBonus}
                          onAntiDiagonalChange={setAntiDiagonalBonus}
                          onCompleteBoardChange={setCompleteBoardBonus}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-48 flex-col items-center justify-center space-y-3 rounded-xl border border-dashed bg-muted/20 text-center">
                      <ArrowUpRight className="h-10 w-10 text-muted-foreground" />
                      <div>
                        <h3 className="text-sm font-semibold">
                          Progression Mechanics
                        </h3>
                        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                          In Progression Bingo, there are no pattern bonuses.
                          Teams must earn{" "}
                          <strong>{tiersUnlockRequirement} XP</strong> in a tier
                          to unlock the next one.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="space-y-4 rounded-xl border bg-muted/30 p-6">
                    <h3 className="text-lg font-semibold">
                      {title || "Untitled Board"}
                    </h3>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">
                          Bingo Type
                        </p>
                        <p className="flex items-center gap-2 font-medium">
                          {bingoType === "standard" ? (
                            <Grid3X3 className="h-4 w-4 text-primary" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-primary" />
                          )}
                          {bingoType === "standard"
                            ? "Standard"
                            : "Progression"}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">
                          Dimensions
                        </p>
                        <p className="font-medium">
                          {rows} × {columns}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">
                          Codephrase
                        </p>
                        <p className="font-mono font-medium">{codephrase}</p>
                      </div>

                      {bingoType === "progression" && (
                        <div>
                          <p className="mb-1 text-xs text-muted-foreground">
                            Tier Requirement
                          </p>
                          <p className="font-medium">
                            {tiersUnlockRequirement} XP
                          </p>
                        </div>
                      )}

                      <div className="col-span-2 mt-2 border-t pt-2">
                        <p className="mb-1 text-xs text-muted-foreground">
                          Unlock Schedule
                        </p>
                        <p className="font-medium">
                          {inheritEventStart
                            ? "At Event Start"
                            : scheduledUnlockDate
                              ? scheduledUnlockDate.toLocaleString()
                              : "Not scheduled"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Ready to create your board? You can manage the
                      board&apos;s tiles from the event dashboard.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <DialogFooter className="mt-8 flex w-full items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={step === 1 ? onClose : handleBack}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {step === 1 ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeft className="h-4 w-4" /> Back
              </>
            )}
          </Button>

          {step < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2"
            >
              Next Step <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "Creating..." : "Create Board"}
              {!isSubmitting && <PlusCircle className="h-4 w-4" />}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

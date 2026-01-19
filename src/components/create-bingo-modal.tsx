"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBingo } from "@/app/actions/bingo"
import { Textarea } from "./ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import generateOSRSCodePhrase from "@/lib/codephraseGenerator"
import { PatternBonusSchematicEditor } from "./pattern-bonus-schematic-editor"

interface CreateBingoModalProps {
  eventId: string
  isOpen: boolean
  onClose: () => void
}

export function CreateBingoModal({
  eventId,
  isOpen,
  onClose,
}: CreateBingoModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [bingoType, setBingoType] = useState<"standard" | "progression">(
    "standard"
  )
  const [rows, setRows] = useState(5)
  const [columns, setColumns] = useState(5)
  const [rowBonuses, setRowBonuses] = useState<Record<number, number>>({})
  const [columnBonuses, setColumnBonuses] = useState<Record<number, number>>({})
  const [mainDiagonalBonus, setMainDiagonalBonus] = useState(0)
  const [antiDiagonalBonus, setAntiDiagonalBonus] = useState(0)
  const [completeBoardBonus, setCompleteBoardBonus] = useState(0)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.append("eventId", eventId)
    formData.append("bingoType", bingoType)

    // Add pattern bonuses from state (for standard boards only)
    if (bingoType === "standard") {
      // Add row bonuses
      for (let i = 0; i < rows; i++) {
        formData.append(`rowBonus-${i}`, String(rowBonuses[i] ?? 0))
      }

      // Add column bonuses
      for (let i = 0; i < columns; i++) {
        formData.append(`columnBonus-${i}`, String(columnBonuses[i] ?? 0))
      }

      // Add diagonal bonuses
      formData.append("mainDiagonalBonus", String(mainDiagonalBonus))
      formData.append("antiDiagonalBonus", String(antiDiagonalBonus))

      // Add complete board bonus
      formData.append("completeBoardBonus", String(completeBoardBonus))
    }

    try {
      await createBingo(formData)
      onClose()
      router.refresh()
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("An unknown error occurred")
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>
            Set up the basic structure for your new bingo game. Tiles will be
            automatically created.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          {error && (
            <div
              className="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
              role="alert"
            >
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div>
              <Label htmlFor="codephrase">Codephrase</Label>
              <Input
                id="codephrase"
                name="codephrase"
                defaultValue={generateOSRSCodePhrase()}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                className="max-w-full"
              />
            </div>

            <div>
              <Label htmlFor="bingoType">Bingo Type</Label>
              <Select
                value={bingoType}
                onValueChange={(value: "standard" | "progression") =>
                  setBingoType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bingo type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Bingo</SelectItem>
                  <SelectItem value="progression">Progression Bingo</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-sm text-muted-foreground">
                {bingoType === "standard"
                  ? "Traditional bingo where all tiles are available from the start"
                  : "Progression-based bingo where teams unlock tiers by completing previous ones"}
              </p>
            </div>

            {bingoType === "progression" && (
              <div>
                <Label htmlFor="tiersUnlockRequirement">
                  XP Required to Unlock Next Tier
                </Label>
                <Input
                  id="tiersUnlockRequirement"
                  name="tiersUnlockRequirement"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={5}
                  required
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Amount of XP (weight) that must be earned in each tier before
                  the next tier unlocks
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="rows">Number of Rows</Label>
                <Input
                  id="rows"
                  name="rows"
                  type="number"
                  min="1"
                  max="10"
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                  required
                />
                {bingoType === "progression" && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Each row becomes a progression tier
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="columns">Number of Columns</Label>
                <Input
                  id="columns"
                  name="columns"
                  type="number"
                  min="1"
                  max="10"
                  value={columns}
                  onChange={(e) => setColumns(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
            </div>

            {bingoType === "standard" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium">
                    Pattern Bonuses (Optional)
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Award extra XP when teams complete full rows, columns, or
                    diagonals. Hover over inputs to see affected tiles.
                  </p>
                </div>

                <PatternBonusSchematicEditor
                  rows={rows}
                  columns={columns}
                  rowBonuses={rowBonuses}
                  columnBonuses={columnBonuses}
                  mainDiagonalBonus={mainDiagonalBonus}
                  antiDiagonalBonus={antiDiagonalBonus}
                  completeBoardBonus={completeBoardBonus}
                  onRowBonusChange={(index, value) =>
                    setRowBonuses((prev) => ({ ...prev, [index]: value }))
                  }
                  onColumnBonusChange={(index, value) =>
                    setColumnBonuses((prev) => ({ ...prev, [index]: value }))
                  }
                  onMainDiagonalChange={setMainDiagonalBonus}
                  onAntiDiagonalChange={setAntiDiagonalBonus}
                  onCompleteBoardChange={setCompleteBoardBonus}
                />
              </div>
            )}

            <Button type="submit">Create Bingo</Button>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { updateBingo, getBingoWithPatternBonuses } from "@/app/actions/bingo"
import { Loader2, Info, Eye, Grid3X3, Lock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PatternBonusSchematicEditor } from "./pattern-bonus-schematic-editor"
import { SettingsDialogLayout } from "./settings-dialog-layout"
import type { BingoType } from "@/server/db/schema"

interface Bingo {
  id: string
  title: string
  description: string | null
  visible: boolean
  locked: boolean
  codephrase: string
}

interface EditBingoModalProps {
  bingo: Bingo
  isOpen: boolean
  onClose: () => void
}

interface BingoPatternData {
  bingoType: BingoType
  rows: number
  columns: number
  mainDiagonalBonusXP: number
  antiDiagonalBonusXP: number
  completeBoardBonusXP: number
  rowBonuses: Array<{ rowIndex: number; bonusXP: number }>
  columnBonuses: Array<{ columnIndex: number; bonusXP: number }>
}

const TABS = [
  { id: "general", label: "General Details", icon: Info },
  { id: "visibility", label: "Visibility & State", icon: Eye },
  { id: "patterns", label: "Pattern Bonuses", icon: Grid3X3 },
]

export function EditBingoModal({
  bingo,
  isOpen,
  onClose,
}: EditBingoModalProps) {
  const [activeTab, setActiveTab] = useState("general")
  const [formData, setFormData] = useState({
    title: bingo.title,
    description: bingo.description ?? "",
    visible: bingo.visible,
    locked: bingo.locked,
    codephrase: bingo.codephrase,
  })

  const [patternData, setPatternData] = useState<BingoPatternData | null>(null)
  const [isLoadingPattern, setIsLoadingPattern] = useState(false)
  const [rowBonuses, setRowBonuses] = useState<Record<number, number>>({})
  const [columnBonuses, setColumnBonuses] = useState<Record<number, number>>({})
  const [mainDiagonalBonus, setMainDiagonalBonus] = useState(0)
  const [antiDiagonalBonus, setAntiDiagonalBonus] = useState(0)
  const [completeBoardBonus, setCompleteBoardBonus] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch pattern bonus data when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingPattern(true)
      void getBingoWithPatternBonuses(bingo.id).then((result) => {
        if (result.success && result.data) {
          const data = result.data
          setPatternData({
            bingoType: data.bingoType,
            rows: data.rows,
            columns: data.columns,
            mainDiagonalBonusXP: data.mainDiagonalBonusXP,
            antiDiagonalBonusXP: data.antiDiagonalBonusXP,
            completeBoardBonusXP: data.completeBoardBonusXP,
            rowBonuses: data.rowBonuses,
            columnBonuses: data.columnBonuses,
          })

          const rowBonusMap: Record<number, number> = {}
          for (let i = 0; i < data.rows; i++) {
            const bonus = data.rowBonuses.find((rb) => rb.rowIndex === i)
            rowBonusMap[i] = bonus?.bonusXP ?? 0
          }
          setRowBonuses(rowBonusMap)

          const columnBonusMap: Record<number, number> = {}
          for (let i = 0; i < data.columns; i++) {
            const bonus = data.columnBonuses.find((cb) => cb.columnIndex === i)
            columnBonusMap[i] = bonus?.bonusXP ?? 0
          }
          setColumnBonuses(columnBonusMap)

          setMainDiagonalBonus(data.mainDiagonalBonusXP)
          setAntiDiagonalBonus(data.antiDiagonalBonusXP)
          setCompleteBoardBonus(data.completeBoardBonusXP)
        }
        setIsLoadingPattern(false)
      })
    }
  }, [isOpen, bingo.id])

  // Reset only when the modal opens so a refresh of `bingo` mid-edit
  // doesn't wipe what the user is typing.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setFormData({
        title: bingo.title,
        description: bingo.description ?? "",
        visible: bingo.visible,
        locked: bingo.locked,
        codephrase: bingo.codephrase,
      })
    }
    wasOpen.current = isOpen
  }, [isOpen, bingo])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const updateData = {
        ...formData,
        patternBonuses:
          patternData?.bingoType === "standard"
            ? {
                rowBonuses,
                columnBonuses,
                mainDiagonalBonus,
                antiDiagonalBonus,
                completeBoardBonus,
              }
            : undefined,
      }

      const result = await updateBingo(bingo.id, updateData)
      if (result.success) {
        toast({
          title: "Success",
          description: "Bingo board updated successfully",
        })
        onClose()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to update bingo board",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "patterns" && patternData?.bingoType === "progression")
      return false
    return true
  })

  return (
    <SettingsDialogLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Board"
      description="Manage your bingo board settings"
      tabs={visibleTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      {activeTab === "general" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">General Details</h3>
            <p className="text-muted-foreground text-sm">
              Basic details about your board.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codephrase">Codephrase</Label>
              <Input
                id="codephrase"
                name="codephrase"
                value={formData.codephrase}
                onChange={handleChange}
                className="text-primary font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "visibility" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Visibility & State</h3>
            <p className="text-muted-foreground text-sm">
              Control who can see and interact with this board.
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-muted/10 flex items-center justify-between rounded-xl border p-4">
              <div className="space-y-1">
                <Label
                  htmlFor="visible"
                  className="flex items-center gap-2 text-base"
                >
                  <Eye className="text-muted-foreground h-4 w-4" />
                  Visible to Participants
                </Label>
                <p className="text-muted-foreground text-sm">
                  When enabled, participants can view the board and submit
                  tiles.
                </p>
              </div>
              <Switch
                id="visible"
                checked={formData.visible}
                onCheckedChange={(checked: boolean) =>
                  handleSwitchChange("visible", checked)
                }
              />
            </div>

            <div className="border-destructive/20 bg-destructive/5 flex items-center justify-between rounded-xl border p-4">
              <div className="space-y-1">
                <Label
                  htmlFor="locked"
                  className="text-danger flex items-center gap-2 text-base"
                >
                  <Lock className="h-4 w-4" />
                  Locked (Prevent Submissions)
                </Label>
                <p className="text-muted-foreground text-sm">
                  When enabled, no new submissions can be made. Board is frozen.
                </p>
              </div>
              <Switch
                id="locked"
                checked={formData.locked}
                onCheckedChange={(checked: boolean) =>
                  handleSwitchChange("locked", checked)
                }
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "patterns" && patternData?.bingoType === "standard" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Pattern Bonuses</h3>
              <p className="text-muted-foreground text-sm">
                Extra XP for completing specific patterns.
              </p>
            </div>
            {isLoadingPattern && (
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            )}
          </div>

          {!isLoadingPattern && (
            <div className="bg-background/80 rounded-xl border p-6 shadow-xs backdrop-blur-xl">
              <PatternBonusSchematicEditor
                rows={patternData.rows}
                columns={patternData.columns}
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
          )}
        </div>
      )}
    </SettingsDialogLayout>
  )
}

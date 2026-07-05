"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { updateBingo, getBingoWithPatternBonuses } from "@/app/actions/bingo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Info, Eye, Grid3X3, ArrowUpRight, Lock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PatternBonusSchematicEditor } from "./pattern-bonus-schematic-editor"
import { cn } from "@/lib/utils"

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
  bingoType: "standard" | "progression"
  rows: number
  columns: number
  mainDiagonalBonusXP: number
  antiDiagonalBonusXP: number
  completeBoardBonusXP: number
  rowBonuses: Array<{ rowIndex: number; bonusXP: number }>
  columnBonuses: Array<{ columnIndex: number; bonusXP: number }>
}

const TABS = [
  { id: 'general', label: 'General Details', icon: Info },
  { id: 'visibility', label: 'Visibility & State', icon: Eye },
  { id: 'patterns', label: 'Pattern Bonuses', icon: Grid3X3 },
];

export function EditBingoModal({ bingo, isOpen, onClose }: EditBingoModalProps) {
  const [activeTab, setActiveTab] = useState('general')
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

  useEffect(() => {
    setFormData({
      title: bingo.title,
      description: bingo.description ?? "",
      visible: bingo.visible,
      locked: bingo.locked,
      codephrase: bingo.codephrase,
    })
  }, [bingo])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        toast({ title: "Success", description: "Bingo board updated successfully" })
        onClose()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "Failed to update bingo board", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'patterns' && patternData?.bingoType === 'progression') return false;
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden flex h-[600px] border-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-muted/40 border-r flex flex-col p-4">
          <DialogHeader className="mb-6 text-left">
            <DialogTitle>Edit Board</DialogTitle>
            <DialogDescription className="text-xs">
              Manage your bingo board settings
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                    activeTab === tab.id 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-background/50">
          <div className="flex-1 overflow-y-auto p-8 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">General Details</h3>
                      <p className="text-sm text-muted-foreground">Basic details about your board.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" name="title" value={formData.title} onChange={handleChange} />
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
                          className="font-mono text-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'visibility' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Visibility & State</h3>
                      <p className="text-sm text-muted-foreground">Control who can see and interact with this board.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/10">
                        <div className="space-y-1">
                          <Label htmlFor="visible" className="text-base flex items-center gap-2">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                            Visible to Participants
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            When enabled, participants can view the board and submit tiles.
                          </p>
                        </div>
                        <Switch
                          id="visible"
                          checked={formData.visible}
                          onCheckedChange={(checked: boolean) => handleSwitchChange("visible", checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between rounded-xl border border-destructive/20 p-4 bg-destructive/5">
                        <div className="space-y-1">
                          <Label htmlFor="locked" className="text-base flex items-center gap-2 text-destructive">
                            <Lock className="w-4 h-4" />
                            Locked (Prevent Submissions)
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            When enabled, no new submissions can be made. Board is frozen.
                          </p>
                        </div>
                        <Switch
                          id="locked"
                          checked={formData.locked}
                          onCheckedChange={(checked: boolean) => handleSwitchChange("locked", checked)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'patterns' && patternData?.bingoType === "standard" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Pattern Bonuses</h3>
                        <p className="text-sm text-muted-foreground">Extra XP for completing specific patterns.</p>
                      </div>
                      {isLoadingPattern && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>

                    {!isLoadingPattern && (
                      <div className="border rounded-xl p-6 bg-background/80 backdrop-blur-xl shadow-sm">
                        <PatternBonusSchematicEditor
                          rows={patternData.rows}
                          columns={patternData.columns}
                          rowBonuses={rowBonuses}
                          columnBonuses={columnBonuses}
                          mainDiagonalBonus={mainDiagonalBonus}
                          antiDiagonalBonus={antiDiagonalBonus}
                          completeBoardBonus={completeBoardBonus}
                          onRowBonusChange={(index, value) => setRowBonuses(prev => ({ ...prev, [index]: value }))}
                          onColumnBonusChange={(index, value) => setColumnBonuses(prev => ({ ...prev, [index]: value }))}
                          onMainDiagonalChange={setMainDiagonalBonus}
                          onAntiDiagonalChange={setAntiDiagonalBonus}
                          onCompleteBoardChange={setCompleteBoardBonus}
                        />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Fixed Footer */}
          <div className="p-4 border-t bg-background flex justify-end gap-2 relative z-10">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

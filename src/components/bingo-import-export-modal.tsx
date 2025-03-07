"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Download, Upload, FileJson, AlertCircle, CheckCircle } from "lucide-react"
import { exportBingoBoard, importBingoBoard, validateImportData } from "@/app/actions/bingo-import-export"
import type { ExportedBingo } from "@/app/actions/bingo-import-export"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface BingoImportExportModalProps {
  eventId: string
  bingoId?: string
  bingoTitle?: string
}

export function BingoImportExportModal({ eventId, bingoId, bingoTitle }: BingoImportExportModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"import" | "export">("import")
  const [isLoading, setIsLoading] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Handle file selection for import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setImportFile(null)
      setValidationResult(null)
      return
    }

    setImportFile(file)
    setImportProgress(25)

    try {
      // Read and validate the file
      const fileContent = await file.text()
      setImportProgress(50)

      let jsonData: unknown
      try {
        jsonData = JSON.parse(fileContent)
        setImportProgress(75)
      } catch (error) {
        setValidationResult({ valid: false, error: "Invalid JSON format" })
        setImportProgress(0)
        return
      }

      // Validate the data structure
      const validation = await validateImportData(jsonData)
      setValidationResult(validation)
      setImportProgress(validation.valid ? 100 : 0)
    } catch (error) {
      setValidationResult({ valid: false, error: "Error reading file" })
      setImportProgress(0)
    }
  }

  // Handle import submission
  const handleImport = async () => {
    if (!importFile || !validationResult?.valid) return

    setIsLoading(true)
    try {
      const fileContent = await importFile.text()
      const importData = JSON.parse(fileContent) as ExportedBingo

      const result = await importBingoBoard(eventId, importData)

      if (result.success) {
        toast({
          title: "Import successful",
          description: "The bingo board has been imported successfully.",
        })
        setIsOpen(false)
        router.refresh()

        // Navigate to the new bingo if we have its ID
        if (result.bingoId) {
          router.push(`/events/${eventId}/bingos/${result.bingoId}`)
        }
      } else {
        toast({
          title: "Import failed",
          description: result.error ?? "Failed to import bingo board",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Import error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle export
  const handleExport = async () => {
    if (!bingoId) {
      toast({
        title: "Export error",
        description: "No bingo board selected for export",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const exportData = await exportBingoBoard(bingoId)

      if ("error" in exportData) {
        throw new Error(exportData.error)
      }

      // Create a downloadable file
      const fileName = `bingo-${bingoTitle?.toLowerCase().replace(/\s+/g, "-") ?? 'export'}-${new Date().toISOString().split("T")[0]}.json`
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      // Create a temporary link and trigger download
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Export successful",
        description: "The bingo board has been exported successfully.",
      })

      setIsOpen(false)
    } catch (error) {
      toast({
        title: "Export error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <FileJson className="h-4 w-4" />
          <span>Import/Export</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bingo Board Import/Export</DialogTitle>
          <DialogDescription>Import a bingo board from a file or export the current board.</DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="import"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "import" | "export")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2" disabled={!bingoId}>
              <Download className="h-4 w-4" />
              <span>Export</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Select Bingo Board File</Label>
              <Input
                id="import-file"
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="cursor-pointer"
              />

              {importProgress > 0 && importProgress < 100 && <Progress value={importProgress} className="h-2 mt-2" />}

              {validationResult && (
                <Alert variant={validationResult.valid ? "default" : "destructive"} className="mt-4">
                  {validationResult.valid ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Valid Bingo Board</AlertTitle>
                      <AlertDescription>The file contains a valid bingo board that can be imported.</AlertDescription>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Invalid Bingo Board</AlertTitle>
                      <AlertDescription>
                        {validationResult.error ?? "The file does not contain a valid bingo board."}
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4 py-4">
            {bingoId ? (
              <div className="space-y-4">
                <Alert>
                  <FileJson className="h-4 w-4" />
                  <AlertTitle>Ready to Export</AlertTitle>
                  <AlertDescription>
                    You are about to export the bingo board &quot;{bingoTitle}&quot;. The export will include all tiles, goals,
                    and board settings.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Bingo Board Selected</AlertTitle>
                <AlertDescription>Please select a bingo board to export.</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          {activeTab === "import" ? (
            <Button onClick={handleImport} disabled={!importFile || !validationResult?.valid || isLoading}>
              {isLoading ? "Importing..." : "Import Board"}
            </Button>
          ) : (
            <Button onClick={handleExport} disabled={!bingoId || isLoading}>
              {isLoading ? "Exporting..." : "Export Board"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Loader2, CheckCircle2 } from "lucide-react"

interface SubmissionUploadFormProps {
  teamName: string
  selectedImage: File | null
  pastedImage: File | null
  isUploading: boolean
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: () => void
  showTeamHeader?: boolean
}

export function SubmissionUploadForm({
  teamName,
  selectedImage,
  pastedImage,
  isUploading,
  onImageChange,
  onSubmit,
  showTeamHeader = true,
}: SubmissionUploadFormProps) {
  return (
    <div className="space-y-4">
      {showTeamHeader && (
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor: `hsl(${(teamName?.charCodeAt(0) ?? 0) * 10 % 360}, 70%, 50%)`,
            }}
          />
          <h3 className="font-semibold text-lg">Submit for {teamName}</h3>
        </div>
      )}

      <div>
        <Label htmlFor="image" className="block text-sm font-medium text-muted-foreground mb-2">
          Upload Image
        </Label>

        {/* Enhanced drag-and-drop upload area */}
        <div className="relative">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground transition-colors bg-muted/20">
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-blue-500/20 rounded-full">
                <Upload className="h-8 w-8 text-blue-500" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Drag and drop your image here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={onImageChange}
                disabled={isUploading}
                className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${(selectedImage ?? pastedImage ?? isUploading) ? 'pointer-events-none' : ''}`}
              />
            </div>
          </div>

          {/* Image preview */}
          {(selectedImage ?? pastedImage) && (
            <div className={`mt-4 p-4 rounded-lg border ${isUploading ? 'bg-blue-500/20 border-blue-500' : 'bg-green-500/20 border-green-500'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isUploading ? 'bg-blue-500/30' : 'bg-green-500/30'}`}>
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isUploading ? 'text-blue-500' : 'text-green-500'}`}>
                    {isUploading ? "Uploading image..." : "Image ready to submit"}
                  </p>
                  <p className={`text-xs ${isUploading ? 'text-blue-500/80' : 'text-green-500/80'}`}>
                    {selectedImage ? selectedImage.name : "Pasted image"}
                  </p>
                </div>
                <Button
                  onClick={onSubmit}
                  disabled={isUploading}
                  className="bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs">V</kbd>
          </div>
          <span>to paste an image directly</span>
        </div>
      </div>
    </div>
  )
}

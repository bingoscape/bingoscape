"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageCircle } from "lucide-react"

interface CommentFormProps {
  submissionId: string
  onSubmit: (comment: string) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function CommentForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: CommentFormProps) {
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const characterCount = comment.length
  const minLength = 10
  const maxLength = 500
  const isValid = characterCount >= minLength && characterCount <= maxLength

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(comment.trim())
      setComment("")
    } catch (error) {
      console.error("Failed to submit comment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel()
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && isValid) {
      void handleSubmit(e)
    }
  }

  return (
    <div className="comment-section expanded">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          Add review comment (required)
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Explain what needs to be reviewed or corrected..."
            className="comment-input resize-none"
            rows={4}
            disabled={isSubmitting || isLoading}
            aria-label="Review comment"
            aria-required="true"
            aria-describedby="comment-help char-counter"
            autoFocus
          />
          <div
            id="char-counter"
            className="character-counter absolute bottom-2 right-2 text-xs"
            aria-live="polite"
          >
            {characterCount}/{maxLength}
          </div>
        </div>

        <div id="comment-help" className="text-xs text-gray-500">
          Minimum {minLength} characters. Use Ctrl+Enter to submit quickly.
        </div>

        <div className="comment-actions flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting || isLoading}
            className="btn btn-secondary"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isValid || isSubmitting || isLoading}
            className={`btn btn-primary ${isSubmitting ? "comment-submitting" : ""}`}
          >
            {isSubmitting ? "Submitting..." : "Mark as Needs Review"}
          </Button>
        </div>
      </form>
    </div>
  )
}

"use client"

import { useState } from "react"
import { MessageCircle, ChevronDown, ChevronUp, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SubmissionComment } from "@/app/actions/events"
import { formatDistanceToNow } from "date-fns"

interface SubmissionCommentProps {
  comments: SubmissionComment[]
  submissionId: string
  canViewComments?: boolean
}

export function SubmissionCommentDisplay({ comments, submissionId, canViewComments = true }: SubmissionCommentProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!canViewComments || comments.length === 0) {
    return null
  }

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="mt-3">
      {/* Comment indicator */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="comment-indicator h-6 px-2 py-1 text-xs"
        aria-expanded={isExpanded}
        aria-label={`${comments.length} comment${comments.length === 1 ? '' : 's'}`}
      >
        <MessageCircle className="w-3 h-3" />
        <span>{comments.length}</span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </Button>

      {/* Expanded comments */}
      {isExpanded && (
        <div
          className={`comment-section ${isExpanded ? 'expanded' : 'collapsed'}`}
          role="region"
          aria-label="Review comments"
        >
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Review Comment{comments.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="comment-display">
                <div className="comment-content text-sm leading-relaxed">
                  {comment.comment}
                </div>
                <div className="comment-metadata">
                  <div className="reviewer-avatar flex items-center justify-center text-xs font-medium text-white">
                    {comment.author.runescapeName?.charAt(0).toUpperCase() ??
                      comment.author.name?.charAt(0).toUpperCase() ??
                      <User className="w-3 h-3" />}
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    {comment.author.runescapeName ?? comment.author.name ?? 'Unknown User'}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

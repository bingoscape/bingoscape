"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PatternCompletionResult } from "@/app/actions/pattern-completion"

interface BonusXPBreakdownProps {
  patterns: PatternCompletionResult
  teamName: string
}

export function BonusXPBreakdown({ patterns, teamName }: BonusXPBreakdownProps) {
  const hasAnyPatterns =
    patterns.completedRows.length > 0 ||
    patterns.completedColumns.length > 0 ||
    (patterns.mainDiagonal ?? false) ||
    (patterns.antiDiagonal ?? false) ||
    (patterns.completeBoard ?? false)

  if (!hasAnyPatterns) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{teamName}</CardTitle>
          <CardDescription>Pattern Completion Bonus</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No patterns completed yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{teamName}</CardTitle>
        <CardDescription>Pattern Completion Bonus</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rows */}
        {patterns.completedRows.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Completed Rows</h4>
            <div className="flex flex-wrap gap-2">
              {patterns.completedRows.map((row) => (
                <Badge key={`row-${row.index}`} variant="default" className="bg-green-600">
                  Row {row.index! + 1}: +{row.bonusXP} XP
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Columns */}
        {patterns.completedColumns.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Completed Columns</h4>
            <div className="flex flex-wrap gap-2">
              {patterns.completedColumns.map((col) => (
                <Badge key={`col-${col.index}`} variant="default" className="bg-blue-600">
                  Column {col.index! + 1}: +{col.bonusXP} XP
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Diagonals */}
        {((patterns.mainDiagonal ?? false) || (patterns.antiDiagonal ?? false)) && (
          <div>
            <h4 className="text-sm font-medium mb-2">Completed Diagonals</h4>
            <div className="flex flex-wrap gap-2">
              {patterns.mainDiagonal && (
                <Badge variant="default" className="bg-purple-600">
                  Main Diagonal: +{patterns.mainDiagonal.bonusXP} XP
                </Badge>
              )}
              {patterns.antiDiagonal && (
                <Badge variant="default" className="bg-purple-600">
                  Anti-Diagonal: +{patterns.antiDiagonal.bonusXP} XP
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Complete Board */}
        {patterns.completeBoard && (
          <div>
            <h4 className="text-sm font-medium mb-2">Complete Board</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="bg-amber-600">
                All Tiles Completed: +{patterns.completeBoard.bonusXP} XP
              </Badge>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Bonus XP:</span>
            <span className="text-2xl font-bold text-amber-600">
              +{patterns.totalBonusXP} XP
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

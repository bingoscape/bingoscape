"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PatternCompletionGrid } from "./pattern-completion-grid"
import type { EventPatternCompletionData } from "@/app/actions/event-pattern-completion"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface PatternCompletionTabProps {
  data: EventPatternCompletionData
}

export function PatternCompletionTab({ data }: PatternCompletionTabProps) {
  const [selectedBoardIndex, setSelectedBoardIndex] = useState(0)
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0)

  // Empty state - no boards with pattern bonuses
  if (data.boards.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Pattern Bonuses</CardTitle>
          <CardDescription>
            No bingo boards in this event have pattern bonuses configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pattern bonuses can be configured when creating or editing a
            standard bingo board. They allow teams to earn extra XP for
            completing rows, columns, diagonals, or the entire board.
          </p>
        </CardContent>
      </Card>
    )
  }

  const selectedBoard = data.boards[selectedBoardIndex]

  // Empty state - no teams
  if (!selectedBoard || selectedBoard.teams.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Teams</CardTitle>
          <CardDescription>
            No teams are participating in this event.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectedTeam = selectedBoard.teams[selectedTeamIndex]

  return (
    <div className="space-y-4">
      {/* Board Selection Tabs */}
      <Tabs
        value={String(selectedBoardIndex)}
        onValueChange={(value) => {
          setSelectedBoardIndex(Number(value))
          setSelectedTeamIndex(0) // Reset team selection when changing boards
        }}
      >
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-lg font-semibold">Select Bingo Board</h3>
            <TabsList
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${data.boards.length}, minmax(0, 1fr))`,
              }}
            >
              {data.boards.map((board, index) => (
                <TabsTrigger key={board.bingo.id} value={String(index)}>
                  {board.bingo.title}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {board.bingo.rows}x{board.bingo.columns}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {data.boards.map((board, boardIndex) => (
            <TabsContent key={board.bingo.id} value={String(boardIndex)}>
              {/* Team Selection Tabs */}
              <Tabs
                value={String(selectedTeamIndex)}
                onValueChange={(value) => setSelectedTeamIndex(Number(value))}
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-lg font-semibold">Select Team</h3>
                    <TabsList
                      className="grid w-full"
                      style={{
                        gridTemplateColumns: `repeat(${board.teams.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {board.teams.map((teamData, index) => (
                        <TabsTrigger
                          key={teamData.team.id}
                          value={String(index)}
                        >
                          {teamData.team.name}
                          <Badge
                            variant={
                              teamData.completionPercentage === 100
                                ? "default"
                                : "secondary"
                            }
                            className="ml-2 text-xs"
                          >
                            {teamData.completionPercentage}%
                          </Badge>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {board.teams.map((teamData, teamIndex) => (
                    <TabsContent
                      key={teamData.team.id}
                      value={String(teamIndex)}
                    >
                      {/* Pattern Completion Details */}
                      <div className="space-y-4">
                        {/* Completion Summary Card */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <span>
                                {teamData.team.name} - Pattern Completion
                              </span>
                              <Badge
                                variant={
                                  teamData.completionPercentage === 100
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {teamData.completionPercentage}% Complete
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              {board.bingo.title} ({board.bingo.rows}x
                              {board.bingo.columns})
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {/* Progress Bar */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    Pattern Bonus Progress
                                  </span>
                                  <span className="font-medium">
                                    {teamData.patterns.totalBonusXP} /{" "}
                                    {board.totalPossibleBonusXP} XP
                                  </span>
                                </div>
                                <Progress
                                  value={teamData.completionPercentage}
                                  className="h-2"
                                />
                              </div>

                              {/* Pattern Summary */}
                              {teamData.patterns.totalBonusXP === 0 ? (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                  No patterns completed yet. Complete rows,
                                  columns, or diagonals to earn bonus XP!
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">
                                      Rows
                                    </div>
                                    <div className="text-lg font-semibold text-green-600">
                                      {teamData.patterns.completedRows.length}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">
                                      Columns
                                    </div>
                                    <div className="text-lg font-semibold text-blue-600">
                                      {
                                        teamData.patterns.completedColumns
                                          .length
                                      }
                                    </div>
                                  </div>
                                  {board.bingo.rows === board.bingo.columns && (
                                    <div className="space-y-1">
                                      <div className="text-muted-foreground">
                                        Diagonals
                                      </div>
                                      <div className="text-lg font-semibold text-purple-600">
                                        {(teamData.patterns.mainDiagonal
                                          ? 1
                                          : 0) +
                                          (teamData.patterns.antiDiagonal
                                            ? 1
                                            : 0)}
                                      </div>
                                    </div>
                                  )}
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">
                                      Full Board
                                    </div>
                                    <div className="text-lg font-semibold text-amber-600">
                                      {teamData.patterns.completeBoard
                                        ? "Yes"
                                        : "No"}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Pattern Grid Visualization */}
                        <PatternCompletionGrid
                          patterns={teamData.patterns}
                          teamName={teamData.team.name}
                          rows={board.bingo.rows}
                          columns={board.bingo.columns}
                          completedTileIndices={
                            new Set(teamData.completedTileIndices)
                          }
                        />
                      </div>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}

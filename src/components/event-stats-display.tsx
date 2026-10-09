"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Target, BarChart3, Users, Copy, Check } from "lucide-react"
import type { EventStatsData } from "@/app/actions/stats"
import { EventRole } from "@/app/actions/events"
import type { ItemStatistics } from "@/app/actions/item-statistics"
import { EventTeamChart } from "@/components/event-team-chart"
import { BingoBreakdownChart } from "@/components/bingo-breakdown-chart"
import { ItemStatisticsDisplay } from "@/components/item-statistics-display"
import { PatternCompletionTab } from "@/components/pattern-completion-tab"
import type { EventPatternCompletionData } from "@/app/actions/event-pattern-completion"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useToast } from "@/hooks/use-toast"
import { generateEventMarkdown } from "@/lib/export-markdown"
import { cn } from "@/lib/utils"

interface EventStatsDisplayProps {
  eventStats: EventStatsData
  eventTitle: string
  userRole: EventRole
  itemStatistics?: ItemStatistics
  patternCompletionData?: EventPatternCompletionData
}

export function EventStatsDisplay({
  eventStats,
  eventTitle,
  itemStatistics,
  patternCompletionData,
}: EventStatsDisplayProps) {
  const { eventTeamPoints, bingoSummary, totalEventXP, totalPossibleEventXP } =
    eventStats

  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  // Check if we have item statistics with data
  const hasItemStats = itemStatistics && itemStatistics.totalSubmissions > 0

  // Check if we have pattern completion data
  const hasPatternData =
    patternCompletionData && patternCompletionData.boards.length > 0

  const overallCompletionRate =
    totalPossibleEventXP > 0 && eventTeamPoints.length > 0
      ? (totalEventXP / (totalPossibleEventXP * eventTeamPoints.length)) * 100
      : 0

  const handleExport = () => {
    const md = generateEventMarkdown(eventStats, itemStatistics, eventTitle)
    navigator.clipboard.writeText(md)
    setCopied(true)
    toast({
      title: "Copied to clipboard",
      description: "Discord Markdown has been copied.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleExport} className="gap-2">
          {copied ? (
            <Check aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
          {copied ? "Copied!" : "Export to Discord"}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users aria-hidden="true" className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-bold">{eventTeamPoints.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Boards</CardTitle>
            <Target aria-hidden="true" className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-bold">{bingoSummary.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overall Progress
            </CardTitle>
            <BarChart3 aria-hidden="true" className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-bold">
              {overallCompletionRate.toFixed(1)}%
            </div>
            <Progress value={overallCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        {hasItemStats && itemStatistics ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submissions</CardTitle>
              <Target aria-hidden="true" className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold">
                {itemStatistics.totalSubmissions.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="hidden lg:block"></div>
        )}
      </div>

      <div className="space-y-8">
        {/* Leaderboard Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {eventTeamPoints.map((team, index) => {
                const teamItemStats = itemStatistics?.teamStats.find((ts) => ts.teamName === team.name)
                
                return (
                  <div
                    key={team.teamId}
                    className="osrs-slot flex flex-col items-start justify-between gap-4 rounded-sm p-4 md:flex-row md:items-center"
                  >
                    <div className="flex items-center space-x-4 min-w-[200px]">
                      <div
                        className={cn(
                          "osrs-bevel flex h-8 w-8 items-center justify-center rounded-sm font-display font-bold",
                          index === 0 && "bg-osrs-gold text-osrs-stone-950",
                          index === 1 && "bg-[#c0c0c0] text-osrs-stone-950",
                          index === 2 && "bg-[#cd7f32] text-osrs-stone-950",
                          index > 2 && "bg-primary text-primary-foreground"
                        )}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{team.name}</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 flex-1 w-full text-sm">
                      <div>
                        <div className="text-muted-foreground">Total XP</div>
                        <div className="osrs-qty text-lg">{team.totalXP.toLocaleString()}</div>
                        {team.bonusXP !== undefined && team.bonusXP > 0 && (
                          <div className="text-xs text-warning">+{team.bonusXP.toLocaleString()} bonus</div>
                        )}
                      </div>
                      
                      <div>
                        <div className="text-muted-foreground">Completion</div>
                        <div className="text-lg font-bold">
                          {totalPossibleEventXP > 0
                            ? `${((team.totalXP / totalPossibleEventXP) * 100).toFixed(1)}%`
                            : "0%"}
                        </div>
                      </div>

                      {teamItemStats && (
                        <>
                          <div>
                            <div className="text-muted-foreground">Loot Value</div>
                            <div className="font-bold text-lg text-success ">
                              {(teamItemStats.totalValue / 1000000).toFixed(1)}M GP
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Submissions</div>
                            <div className="text-lg font-bold">{teamItemStats.submissionCount}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              {eventTeamPoints.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No team data available yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Board Progress Grid */}
        <div>
          <h2 className="osrs-heading mb-4 text-xl font-bold">Board Progress</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bingoSummary.map((bingo) => (
              <Card key={bingo.bingoId}>
                <CardHeader>
                  <CardTitle className="text-lg">{bingo.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total XP Available</span>
                      <span className="font-mono">{bingo.totalPossibleXP.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Completion Rate</span>
                      <span className="font-mono">{bingo.completionRate}%</span>
                    </div>
                    <Progress value={bingo.completionRate} className="mt-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {bingoSummary.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground">
                No Boards found for this Event
              </div>
            )}
          </div>
        </div>

        {/* Item Statistics Integration */}
        {hasItemStats && itemStatistics && (
          <div className="mt-8">
            <h2 className="osrs-heading mb-4 text-xl font-bold">Player & Economy Highlights</h2>
            <ItemStatisticsDisplay
              statistics={itemStatistics}
              title={eventTitle}
            />
          </div>
        )}

        {/* Visualizations */}
        <div>
          <h2 className="osrs-heading mb-4 text-xl font-bold">Event Visualizations</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EventTeamChart
              data={eventTeamPoints}
              totalPossibleXP={totalPossibleEventXP}
              title="Team XP Comparison"
            />
            <BingoBreakdownChart
              data={eventTeamPoints}
              bingoSummary={bingoSummary}
              title="XP Distribution by Board"
            />
          </div>
        </div>

        {/* Accordions for deep data */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="breakdown">
            <AccordionTrigger className="text-xl font-bold">Detailed Points Breakdown</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-4">
                {eventTeamPoints.map((team) => (
                  <div key={team.teamId} className="osrs-slot rounded-sm p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{team.name}</h3>
                      <Badge variant="secondary">
                        {team.totalXP.toLocaleString()} XP Total
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {team.bingoBreakdown.map((bingo) => (
                        <div key={bingo.bingoId} className="osrs-slot rounded-sm p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{bingo.bingoTitle}</span>
                            <span className="font-mono text-sm">{bingo.xp.toLocaleString()} XP</span>
                          </div>
                          {bingo.bonusXP !== undefined && bingo.bonusXP > 0 && (
                            <div className="mt-1 text-xs text-warning">
                              Base: {bingo.baseXP?.toLocaleString() ?? 0} + Bonus: {bingo.bonusXP.toLocaleString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {hasPatternData && patternCompletionData && (
            <AccordionItem value="patterns">
              <AccordionTrigger className="text-xl font-bold">Pattern Completion</AccordionTrigger>
              <AccordionContent>
                <div className="pt-4">
                  <PatternCompletionTab data={patternCompletionData} />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

      </div>
    </div>
  )
}


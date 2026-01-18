"use client"

import { useState } from "react"
import Link from "next/link"
import { CreateEventModal } from "./create-event-modal"
import { type getEvents } from "@/app/actions/events"
import { EventDisplay } from "./events-display"
import { Button } from "@/components/ui/button"
import { Plus, TrendingUp, Users, Trophy } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface EventListProps {
  userId: string
  initialEvents: Awaited<ReturnType<typeof getEvents>>
}

export default function EventList({ userId, initialEvents }: EventListProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const allEvents = initialEvents

  const hasEvents = allEvents.length > 0

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10" />
        <div className="relative rounded-2xl bg-gradient-to-r from-card to-muted/50 p-8 lg:p-12">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-4xl font-bold text-transparent lg:text-5xl">
                    Your Events
                  </h1>
                  <p className="mt-2 text-lg text-muted-foreground">
                    Manage and track your RuneScape bingo events
                  </p>
                </div>
              </div>
              {!hasEvents && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                  <p className="font-medium text-blue-700 dark:text-blue-300">
                    👋 Welcome to BingoScape!
                  </p>
                  <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                    Create your first event to start organizing epic bingo
                    competitions with your clan or friends.
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/templates">
                  <Users className="mr-2 h-4 w-4" />
                  Browse Templates
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats - only show if user has events */}
      {hasEvents && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">{allEvents.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Across all time periods
              </p>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-blue-500" />
                Active Events
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">
                {
                  allEvents.filter((e) => {
                    const now = new Date()
                    const start = new Date(e.event.startDate)
                    const end = new Date(e.event.endDate)
                    return now >= start && now <= end
                  }).length
                }
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Currently running
              </p>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Total Prize Pool
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">
                {(() => {
                  const total = allEvents.reduce(
                    (sum, event) => sum + event.totalPrizePool,
                    0
                  )
                  if (total >= 1000000000)
                    return `${(total / 1000000000).toFixed(1)}B`
                  if (total >= 1000000)
                    return `${(total / 1000000).toFixed(1)}M`
                  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`
                  return total.toString()
                })()}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Across all events
              </p>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-purple-500" />
                Total Bingos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">
                {allEvents.reduce(
                  (sum, event) => sum + (event.event.bingos?.length ?? 0),
                  0
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Across all events
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Events Display */}
      <div className={hasEvents ? "" : "mx-auto max-w-6xl"}>
        <EventDisplay initialEvents={allEvents} />
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  )
}

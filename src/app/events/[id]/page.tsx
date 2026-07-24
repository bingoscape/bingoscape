import { notFound } from "next/navigation"
import { getServerAuthSession } from "@/server/auth"

import type { UUID } from "crypto"
import { TeamManagement } from "@/components/team-management"
import { TeamDisplay } from "@/components/team-display"
import { getCurrentTeamForUser } from "@/app/actions/team"
import { EventBingosClient } from "@/components/event-bingos-client"
import { EventDetailsCard } from "@/components/event-details-card"
import { getEventById } from "@/server/queries/events"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function EventBingosPage(props: {
  params: Promise<{ id: UUID }>
}) {
  const params = await props.params
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    notFound()
  }

  const [data, currentTeam] = await Promise.all([
    getEventById(params.id),
    getCurrentTeamForUser(params.id),
  ])

  if (!data) {
    notFound()
  }

  const { event, userRole } = data

  if (!userRole) {
    // Layout handles the non-participant view
    return null
  }

  const isAdminOrManagement = userRole === "admin" || userRole === "management"

  return (
    <main className="w-full">
      <EventDetailsCard eventId={event.id} />
      
      <Tabs defaultValue="boards" className="w-full">
        <div className="mb-6 flex items-center justify-between border-b border-border/40 pb-4">
          <TabsList className="h-10 bg-transparent p-0">
            <TabsTrigger 
              value="boards" 
              className="relative h-10 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Boards
            </TabsTrigger>
            <TabsTrigger 
              value="teams" 
              className="relative h-10 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Teams
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="boards" className="mt-0 outline-none">
          <EventBingosClient
            event={event}
            userRole={userRole}
            currentTeam={currentTeam}
            isAdminOrManagement={isAdminOrManagement}
          />
        </TabsContent>
        
        <TabsContent value="teams" className="mt-0 outline-none">
          {isAdminOrManagement ? (
            <TeamManagement eventId={event.id} />
          ) : (
            <TeamDisplay eventId={event.id} />
          )}
        </TabsContent>
      </Tabs>
    </main>
  )
}

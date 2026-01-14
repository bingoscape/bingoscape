import { getUserDetails } from "@/app/actions/super-admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Calendar, Shield, Users } from "lucide-react"
import { SuperAdminUserEditModal } from "@/components/super-admin-user-edit-modal"
import { SuperAdminUserDeleteModal } from "@/components/super-admin-user-delete-modal"

interface PageProps {
  params: Promise<{
    userId: string
  }>
}

export default async function UserDetailsPage(props: PageProps) {
  const params = await props.params;
  const userDetails = await getUserDetails(params.userId)
  const { user, clans, participatingEvents, createdEvents } = userDetails

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/super-admin/users">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">User Details</h2>
            <p className="text-muted-foreground">Detailed information about {user.name ?? user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <SuperAdminUserEditModal user={user} />
          <SuperAdminUserDeleteModal user={user} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.image ?? ""} />
                <AvatarFallback>{user.name?.charAt(0) ?? user.email?.charAt(0) ?? "U"}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{user.name ?? "No name set"}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.runescapeName && <p className="text-sm text-muted-foreground">RSN: {user.runescapeName}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">User ID:</span>
                <span className="text-sm font-mono">{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email Verified:</span>
                <Badge variant={user.emailVerified ? "default" : "secondary"}>
                  {user.emailVerified ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Clans:</span>
                <span className="text-sm">{clans.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Events Created:</span>
                <span className="text-sm">{createdEvents.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Events Participating:</span>
                <span className="text-sm">{participatingEvents.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Clan Memberships
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not a member of any clans</p>
            ) : (
              <div className="space-y-3">
                {clans.map((membership) => (
                  <div key={membership.clan.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Link href={`/super-admin/clans/${membership.clan.id}`} className="font-medium hover:underline">
                        {membership.clan.name}
                      </Link>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">
                          {membership.role}
                        </Badge>
                        {membership.isMain && (
                          <Badge variant="default">
                            Main Clan
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(membership.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Created Events ({createdEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {createdEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events created</p>
            ) : (
              <div className="space-y-3">
                {createdEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="p-3 border rounded-lg">
                    <Link href={`/super-admin/events/${event.id}`} className="font-medium hover:underline">
                      {event.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant={event.locked ? "destructive" : "default"}>
                        {event.locked ? "Locked" : "Open"}
                      </Badge>
                      <Badge variant={event.public ? "default" : "secondary"}>
                        {event.public ? "Public" : "Private"}
                      </Badge>
                    </div>
                  </div>
                ))}
                {createdEvents.length > 5 && (
                  <p className="text-sm text-muted-foreground">And {createdEvents.length - 5} more...</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Participating Events ({participatingEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {participatingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not participating in any events</p>
            ) : (
              <div className="space-y-3">
                {participatingEvents.slice(0, 5).map((participation) => (
                  <div key={participation.event.id} className="p-3 border rounded-lg">
                    <Link
                      href={`/super-admin/events/${participation.event.id}`}
                      className="font-medium hover:underline"
                    >
                      {participation.event.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(participation.event.startDate).toLocaleDateString()} -{" "}
                      {new Date(participation.event.endDate).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">
                        {participation.role}
                      </Badge>
                      <Badge variant={participation.event.locked ? "destructive" : "default"}>
                        {participation.event.locked ? "Locked" : "Open"}
                      </Badge>
                    </div>
                  </div>
                ))}
                {participatingEvents.length > 5 && (
                  <p className="text-sm text-muted-foreground">And {participatingEvents.length - 5} more...</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

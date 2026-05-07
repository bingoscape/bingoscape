import { notFound, unauthorized, forbidden } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { getServerAuthSession } from "@/server/auth"
import { type UUID } from "crypto"
import { getEventById } from "@/app/actions/events"
import { createBingoAndRedirect } from "@/app/actions/bingo"

export default async function Page(props: { params: Promise<{ id: UUID }> }) {
  const params = await props.params
  const session = await getServerAuthSession()
  if (!session?.user) {
    unauthorized()
  }

  const data = await getEventById(params.id)
  if (!data) notFound()
  if (!(data.userRole === "admin" || data.userRole === "management")) {
    forbidden()
  }

  const { event } = data

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create New Bingo for {event.title}</CardTitle>
          <CardDescription>
            Set up the basic structure for your new bingo game.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createBingoAndRedirect} className="space-y-4">
            <input type="hidden" name="eventId" value={event.id} />

            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" />
            </div>

            <div>
              <Label htmlFor="codephrase">Codephrase</Label>
              <Input id="codephrase" name="codephrase" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="rows">Number of Rows</Label>
                <Input
                  id="rows"
                  name="rows"
                  type="number"
                  min="1"
                  max="10"
                  required
                />
              </div>
              <div>
                <Label htmlFor="columns">Number of Columns</Label>
                <Input
                  id="columns"
                  name="columns"
                  type="number"
                  min="1"
                  max="10"
                  required
                />
              </div>
            </div>

            <Button type="submit">Create Bingo</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

import { notFound, redirect } from "next/navigation"
import { events, bingos, tiles } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import { type UUID } from "crypto"
import { getEventById, getUserRole } from "@/app/actions/events"

async function createBingo(formData: FormData) {
    'use server'

    const eventId = formData.get('eventId') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const rows = parseInt(formData.get('rows') as string)
    const columns = parseInt(formData.get('columns') as string)
    const codephrase = formData.get('codephrase') as string

    const newBingo = await db.insert(bingos).values({
        eventId,
        title,
        description,
        codephrase,
        rows,
        columns,
    }).returning({ id: bingos.id })

    const bingoId = newBingo[0]!.id

    // Create tiles for the bingo
    const tilesToInsert = []
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            tilesToInsert.push({
                bingoId,
                headerImage: '/placeholder.svg?height=100&width=100', // Default placeholder image
                title: `Tile ${row * columns + col + 1}`,
                description: `Tile ${row * columns + col + 1}`,
                weight: 1,
                index: row * columns + col,
            })
        }
    }

    await db.insert(tiles).values(tilesToInsert)

    return redirect(`/events/${eventId}/bingos/${newBingo[0]!.id}`)
}

export default async function Page({ params }: { params: { id: UUID } }) {
    const session = await getServerAuthSession()
    if (!session || !session.user) {
        notFound()
    }

    const data = await getEventById(params.id)

    if (!data || !(data.userRole === 'admin' || data.userRole === 'management')) {
        notFound()
    }

    const { event } = data

    return (
        <div className="container mx-auto py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Create New Bingo for {event.title}</CardTitle>
                    <CardDescription>Set up the basic structure for your new bingo game.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={createBingo} className="space-y-4">
                        <input type="hidden" name="eventId" value={event.id} />

                        <div>
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" name="title" required />
                        </div>

                        <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input id="startDate" name="startDate" type="date" required />
                            </div>
                            <div>
                                <Label htmlFor="endDate">End Date</Label>
                                <Input id="endDate" name="endDate" type="date" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="rows">Number of Rows</Label>
                                <Input id="rows" name="rows" type="number" min="1" max="10" required />
                            </div>
                            <div>
                                <Label htmlFor="columns">Number of Columns</Label>
                                <Input id="columns" name="columns" type="number" min="1" max="10" required />
                            </div>
                        </div>

                        <Button type="submit">Create Bingo</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

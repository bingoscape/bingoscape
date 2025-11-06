import { redirect } from "next/navigation"

export default function EventRegistrationsPage({
  params,
}: {
  params: { id: string }
}) {
  // Redirect to participants page with registrations tab
  redirect(`/events/${params.id}/participants?tab=registrations`)
}

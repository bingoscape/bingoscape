import { redirect } from "next/navigation"

export default async function EventRegistrationsPage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  // Redirect to participants page with registrations tab
  redirect(`/events/${params.id}/participants?tab=registrations`)
}

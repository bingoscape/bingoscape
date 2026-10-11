import { redirect } from "next/navigation"

// "My Events" was merged into the dashboard; keep old links and bookmarks working.
export default function MyEventsPage() {
  redirect("/?role=admin")
}

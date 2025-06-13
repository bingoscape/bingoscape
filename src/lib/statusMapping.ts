// TODO: this should be removed after changing the state in the runelite plugin
export function mapStatus(status: "pending" | "approved" | "needs_review"): "pending" | "accepted" | "requires_interaction" | "not_submitted" {
  switch (status) {
    case "pending":
      return "pending"
    case "approved":
      return "accepted"
    case "needs_review":
      return "requires_interaction"
    default:
      return "not_submitted"
  }
}

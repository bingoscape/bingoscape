// Maps new internal state back to old state for the runelite plugin
export function mapStatus(
  status: "incomplete" | "completed" | "needs_attention" | "pending" | "approved" | "needs_review"
): "pending" | "accepted" | "requires_interaction" | "not_submitted" {
  switch (status) {
    case "incomplete":
    case "pending":
      return "pending"
    case "completed":
    case "approved":
      return "accepted"
    case "needs_attention":
    case "needs_review":
      return "requires_interaction"
    default:
      return "not_submitted"
  }
}

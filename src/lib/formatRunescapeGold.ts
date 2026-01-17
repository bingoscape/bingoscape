export default function formatRunescapeGold(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`
  } else if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`
  } else {
    return amount.toString()
  }
}

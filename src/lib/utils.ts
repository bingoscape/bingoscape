import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function createArray(length: number) {
  return Array.from({ length }, (_, index) => index)
}

export function formatRunescapeGold(amount: number): string {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1)}B`
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`
  } else {
    return amount.toString()
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

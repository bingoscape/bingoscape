import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function createArray(length: number) {
  return Array.from({ length }, (_, index) => index)
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

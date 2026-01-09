import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatGrams(grams: number | null | undefined): string {
  if (grams === null || grams === undefined) return '---'
  return `${grams.toFixed(1)}g`
}

export function formatPercent(percent: number | null | undefined): string {
  if (percent === null || percent === undefined) return '---'
  return `${Math.round(percent)}%`
}

export function getStatusColor(value: number, thresholds: { low: number; medium: number }) {
  if (value >= thresholds.medium) return 'text-green-500'
  if (value >= thresholds.low) return 'text-yellow-500'
  return 'text-red-500'
}

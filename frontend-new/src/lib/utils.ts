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

/**
 * Konvertiert Ultraschall-Distanz (mm vom Backend) zu Tankfüllstand (%)
 * @param distanceMm Gemessene Distanz in mm (vom Backend)
 * @param minDistance Minimale Distanz bei vollem Tank in mm (default: 30mm = 3cm)
 * @param maxDistance Maximale Distanz bei leerem Tank in mm (default: 230mm = 23cm)
 * @returns Füllstand in Prozent (0-100)
 */
export function distanceToPercent(
  distanceMm: number | null | undefined,
  minDistance: number = 30,
  maxDistance: number = 230
): number {
  if (distanceMm === null || distanceMm === undefined) return 0

  // Backend liefert mm - Invertierte Berechnung: Je kleiner die Distanz, desto voller der Tank
  const clampedDistance = Math.max(minDistance, Math.min(maxDistance, distanceMm))
  const percent = 100 - ((clampedDistance - minDistance) / (maxDistance - minDistance)) * 100

  return Math.max(0, Math.min(100, percent))
}

export function getStatusColor(value: number, thresholds: { low: number; medium: number }) {
  if (value >= thresholds.medium) return 'text-green-500'
  if (value >= thresholds.low) return 'text-yellow-500'
  return 'text-red-500'
}

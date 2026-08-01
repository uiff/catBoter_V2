/** Zentrale Formatierung - eine Stelle für Einheiten und Zeit. */

export function formatGrams(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return `${value.toFixed(digits).replace(/\.0$/, '')} g`
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return `${Math.round(value)} %`
}

export function formatCm(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return `${value.toFixed(1)} cm`
}

/** "HH:MM:SS" oder "HH:MM" -> "HH:MM" */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '–'
  return time.slice(0, 5)
}

/** ISO-String -> lokale Uhrzeit "HH:MM:SS" */
export function formatIsoTime(iso: string | null | undefined): string {
  if (!iso) return '–'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '–'
  return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '–'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`
}

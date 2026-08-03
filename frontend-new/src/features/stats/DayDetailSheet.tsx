import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, HandPlatter } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { api } from '@/lib/api'
import { formatGrams } from '@/lib/format'
import type { DailyEntry } from '@/types/api'
import { History } from 'lucide-react'

const FEEDING_TYPES = new Set(['feeding_completed', 'feeding_failed', 'hand_feed'])

/** "2026-08-01" -> "Freitag, 1. August" */
function formatDateLong(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Tages-Detail zum angetippten Trend-Balken: Kennzahlen + Fütterungen des Tages. */
export function DayDetailSheet({
  entry,
  onClose,
}: {
  entry: DailyEntry | null
  onClose: () => void
}) {
  // Ereignis-Log weit genug zurück laden, um den Tag abzudecken (max 90 Tage)
  const daysBack = entry
    ? Math.min(
        90,
        Math.max(
          1,
          Math.ceil((Date.now() - new Date(`${entry.date}T00:00:00`).getTime()) / 86_400_000) + 1,
        ),
      )
    : 1
  const events = useQuery({
    queryKey: ['events-day', entry?.date],
    queryFn: () => api.getEvents(daysBack),
    enabled: entry !== null,
    staleTime: 60_000,
  })
  const dayFeedings = (events.data ?? []).filter(
    (event) => event.ts.startsWith(entry?.date ?? '') && FEEDING_TYPES.has(event.type),
  )

  return (
    <Sheet open={entry !== null} onClose={onClose} title={entry ? formatDateLong(entry.date) : ''}>
      {entry && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-surface-2 p-3">
              <p className="text-xs text-muted-foreground">Gesamt</p>
              <p className="tnum text-lg font-semibold tracking-tight">{formatGrams(entry.total)}</p>
            </div>
            <div className="rounded-md bg-surface-2 p-3">
              <p className="text-xs text-muted-foreground">Fütterungen</p>
              <p className="tnum text-lg font-semibold tracking-tight">{entry.feedings}</p>
            </div>
            <div className="rounded-md bg-surface-2 p-3">
              <p className="text-xs text-muted-foreground">Ø je Fütterung</p>
              <p className="tnum text-lg font-semibold tracking-tight">
                {formatGrams(entry.avg_per_feeding)}
              </p>
            </div>
            <div className="rounded-md bg-surface-2 p-3">
              <p className="text-xs text-muted-foreground">Min / Max</p>
              <p className="tnum text-lg font-semibold tracking-tight">
                {Math.round(entry.min)} / {Math.round(entry.max)} g
              </p>
            </div>
          </div>

          {events.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : dayFeedings.length === 0 ? (
            <EmptyState
              icon={History}
              title="Keine Einzel-Ereignisse"
              description="Für diesen Tag liegen keine Verlaufs-Einträge mehr vor."
            />
          ) : (
            <ul className="divide-y divide-border">
              {dayFeedings.map((event, index) => (
                <li key={`${event.ts}-${index}`} className="flex items-center gap-3 py-2">
                  {event.type === 'feeding_failed' ? (
                    <CircleX className="h-4 w-4 shrink-0 text-danger" />
                  ) : event.type === 'hand_feed' ? (
                    <HandPlatter className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <CircleCheck className="h-4 w-4 shrink-0 text-success" />
                  )}
                  <span className="tnum text-sm font-medium">{event.ts.slice(11, 16)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {event.detail}
                  </span>
                  {event.grams !== undefined && (
                    <span className="tnum shrink-0 text-sm">{formatGrams(event.grams)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  )
}

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  Cat,
  CircleCheck,
  CircleSlash,
  CircleX,
  FileDown,
  HandPlatter,
  HeartPulse,
  History,
  Info,
  PauseCircle,
  Power,
  Target,
} from 'lucide-react'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { EmptyState, SegmentedControl, Skeleton } from '@/components/ui/Misc'
import { api } from '@/lib/api'
import { formatGrams } from '@/lib/format'

type Period = '7' | '30'

const EVENT_META: Record<string, { icon: LucideIcon; className: string }> = {
  feeding_completed: { icon: CircleCheck, className: 'text-success' },
  feeding_failed: { icon: CircleX, className: 'text-danger' },
  feeding_skipped: { icon: CircleSlash, className: 'text-info' },
  pause: { icon: PauseCircle, className: 'text-warning' },
  backend_start: { icon: Power, className: 'text-muted-foreground' },
  hand_feed: { icon: HandPlatter, className: 'text-success' },
  diet: { icon: Target, className: 'text-info' },
  diet_clamp: { icon: Target, className: 'text-warning' },
  diet_skipped: { icon: Target, className: 'text-warning' },
  jit_gate: { icon: Cat, className: 'text-warning' },
  jit_withheld: { icon: Cat, className: 'text-warning' },
  health: { icon: HeartPulse, className: 'text-info' },
}

const DEFAULT_META = { icon: Info, className: 'text-muted-foreground' }

/** ISO-String -> "DD.MM. HH:MM" */
function formatEventTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '–'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Verlauf: Ereignis-Log des Backends mit CSV-Export. */
export function EventsCard() {
  const [period, setPeriod] = useState<Period>('7')
  const days = period === '7' ? 7 : 30

  const events = useQuery({
    queryKey: ['events', days],
    queryFn: () => api.getEvents(days),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })

  return (
    <CollapsibleCard title="Verlauf" icon={<History className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        <SegmentedControl<Period>
          options={[
            { value: '7', label: '7 Tage' },
            { value: '30', label: '30 Tage' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        {events.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !events.data || events.data.length === 0 ? (
          <EmptyState
            icon={History}
            title="Keine Ereignisse"
            description="Im gewählten Zeitraum wurde nichts aufgezeichnet."
          />
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {events.data.map((entry, index) => {
              const meta = EVENT_META[entry.type] ?? DEFAULT_META
              const EventIcon = meta.icon
              return (
                <li key={`${entry.ts}-${index}`} className="flex items-center gap-3 py-2.5">
                  <EventIcon className={`h-5 w-5 shrink-0 ${meta.className}`} />
                  <span className="tnum shrink-0 text-sm font-medium">
                    {formatEventTime(entry.ts)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {entry.detail}
                  </span>
                  {entry.grams !== undefined && (
                    <span className="tnum shrink-0 text-sm">{formatGrams(entry.grams)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <a
          href={api.eventsCsvUrl}
          download
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileDown className="h-4 w-4" />
          CSV exportieren
        </a>
      </div>
    </CollapsibleCard>
  )
}

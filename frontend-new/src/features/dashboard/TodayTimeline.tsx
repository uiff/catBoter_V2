import { ArrowDownWideNarrow, ArrowUpNarrowWide, Cat, CircleCheck, CircleSlash, CircleX, Clock, Hand, HandPlatter, PawPrint, Shuffle, Timer } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { formatGrams, formatTime } from '@/lib/format'
import { useUiStore } from '@/stores/uiStore'
import type { TodayFeeding } from '@/types/api'
import { cn } from '@/lib/utils'

interface TodayTimelineProps {
  feedings: TodayFeeding[] | undefined
  loading: boolean
  /** Statistik-Seite: als aufklappbare Karte (das Dashboard bleibt offen) */
  collapsible?: boolean
}

function statusFor(feeding: TodayFeeding, now: Date) {
  if (feeding.type === 'manual' || feeding.type === 'hand') return 'done'
  if (feeding.status === true) return 'done'
  if (feeding.status === false) return 'failed'
  const [h, m] = feeding.time.split(':').map(Number)
  const due = new Date(now)
  due.setHours(h, m, 0, 0)
  return due <= now ? 'overdue' : 'pending'
}

const TYPE_META = {
  auto: { label: 'Plan', icon: Clock },
  random: { label: 'Zufall', icon: Shuffle },
  manual: { label: 'Manuell', icon: Hand },
  hand: { label: 'Von Hand', icon: HandPlatter },
} as const

export function TodayTimeline({ feedings, loading, collapsible = false }: TodayTimelineProps) {
  const now = new Date()
  const order = useUiStore((s) => s.timelineOrder)
  const setOrder = useUiStore((s) => s.setTimelineOrder)

  // Backend liefert aufsteigend nach Uhrzeit; 'desc' = neueste zuoberst
  const ordered = feedings && order === 'desc' ? [...feedings].reverse() : feedings

  const sortButton = (
    <button
      onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
      className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={
        order === 'desc'
          ? 'Sortierung: neueste zuerst - tippen für chronologisch'
          : 'Sortierung: chronologisch - tippen für neueste zuerst'
      }
      title={order === 'desc' ? 'Neueste zuerst' : 'Chronologisch'}
    >
      {order === 'desc' ? (
        <ArrowDownWideNarrow className="h-4 w-4" />
      ) : (
        <ArrowUpNarrowWide className="h-4 w-4" />
      )}
    </button>
  )

  const list =
    loading && !feedings ? (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    ) : !ordered || ordered.length === 0 ? (
      <EmptyState icon={PawPrint} title="Heute noch keine Fütterung" />
    ) : (
      <ul className="divide-y divide-border">
        {ordered.map((feeding, index) => {
          const status = statusFor(feeding, now)
          const skipped = feeding.skipped === true
          const meta = TYPE_META[feeding.type]
          const TypeIcon = meta.icon
          const eatenBy = feeding.eaten_by ? Object.entries(feeding.eaten_by) : []
          return (
            <li key={`${feeding.time}-${index}`} className="py-2.5">
              <div className="flex items-center gap-3">
              {skipped ? (
                <CircleSlash className="h-5 w-5 shrink-0 text-info" />
              ) : (
                <>
                  {status === 'done' && <CircleCheck className="h-5 w-5 shrink-0 text-success" />}
                  {status === 'failed' && <CircleX className="h-5 w-5 shrink-0 text-danger" />}
                  {status === 'pending' && <Timer className="h-5 w-5 shrink-0 text-muted-foreground" />}
                  {status === 'overdue' && <Timer className="h-5 w-5 shrink-0 text-warning" />}
                </>
              )}

              <span className="tnum w-12 font-medium">{formatTime(feeding.time)}</span>

              <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                <TypeIcon className="h-3 w-3" />
                {meta.label}
              </span>

              {skipped ? (
                <span className="ml-auto text-sm text-info">
                  {feeding.skipped_diet ? 'übersprungen · Diät-Budget' : 'übersprungen · Napf voll'}
                </span>
              ) : (
                <span className={cn('tnum ml-auto text-sm', status === 'pending' && 'text-muted-foreground')}>
                  {status === 'done' || status === 'failed'
                    ? formatGrams(feeding.amount)
                    : `geplant ${formatGrams(feeding.planned_amount)}`}
                </span>
              )}
              </div>
              {/* Wer hat diese Ausgabe gefressen? (Waagen-Erkennung/Labels) */}
              {eatenBy.length > 0 && (
                <p className="tnum flex items-center gap-1.5 pl-8 pt-1 text-xs text-muted-foreground">
                  <Cat className="h-3 w-3 shrink-0" />
                  {eatenBy.map(([name, grams]) => `${name} ${grams} g`).join(' · ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    )

  if (collapsible) {
    return (
      <CollapsibleCard
        title="Heute"
        icon={<Clock className="h-4 w-4" />}
        summary={feedings?.length ? `${feedings.length} Einträge` : undefined}
      >
        <div className="pt-1">
          <div className="flex justify-end">{sortButton}</div>
          {list}
        </div>
      </CollapsibleCard>
    )
  }

  return (
    <Card>
      <CardHeader title="Heute" icon={<Clock className="h-4 w-4" />} action={sortButton} />
      <CardContent className="pt-3">{list}</CardContent>
    </Card>
  )
}

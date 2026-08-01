/** Eine Karte pro Fütterungsplan - Name, Typ, Kurzfassung und Aktionen. */
import { Clock, Dices, Pencil, Play, Shuffle, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatGrams, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AutoPlan, RandomPlan } from '@/types/feeding'

/** Diskriminierte Vereinigung beider Plantypen für Liste, Karte und Editor. */
export type PlanItem =
  | { kind: 'auto'; plan: AutoPlan }
  | { kind: 'random'; plan: RandomPlan }

interface PlanCardProps {
  item: PlanItem
  onActivate: () => void
  onEdit: () => void
  onDelete: () => void
  /** Nur für den aktiven Zufallsplan: Zeiten neu auswürfeln */
  onRegenerate?: () => void
  activating?: boolean
  regenerating?: boolean
}

function summaryFor(item: PlanItem): string {
  if (item.kind === 'auto') {
    const { plan } = item
    const dayCount = plan.selectedDays.length
    const firstDay = plan.selectedDays[0]
    const feedings = firstDay ? plan.feedingSchedule[firstDay]?.length ?? 0 : 0
    const daily =
      plan.dailyWeight ??
      (firstDay
        ? (plan.feedingSchedule[firstDay] ?? []).reduce((sum, f) => sum + f.weight, 0)
        : 0)
    return `${feedings} ${feedings === 1 ? 'Fütterung' : 'Fütterungen'} an ${dayCount} ${
      dayCount === 1 ? 'Tag' : 'Tagen'
    } · ${formatGrams(daily)}/Tag`
  }
  const { plan } = item
  return `${formatTime(plan.startTime)}–${formatTime(plan.endTime)} · ${formatGrams(
    plan.dailyWeight,
  )}/Tag · min. ${plan.minInterval} min Abstand`
}

export function PlanCard({
  item,
  onActivate,
  onEdit,
  onDelete,
  onRegenerate,
  activating = false,
  regenerating = false,
}: PlanCardProps) {
  const { plan } = item
  const TypeIcon = item.kind === 'auto' ? Clock : Shuffle

  return (
    <Card className={cn(plan.active && 'border-primary')}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{plan.planName}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
              <TypeIcon className="h-3 w-3" />
              {item.kind === 'auto' ? 'Feste Zeiten' : 'Zufällig'}
            </span>
          </div>
          {plan.active && (
            <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
              Aktiv
            </span>
          )}
        </div>

        <p className="tnum text-sm text-muted-foreground">{summaryFor(item)}</p>

        <div className="flex flex-wrap gap-2 pt-1">
          {!plan.active && (
            <Button className="w-full" onClick={onActivate} loading={activating}>
              <Play className="h-4 w-4" />
              Aktivieren
            </Button>
          )}
          {item.kind === 'random' && plan.active && onRegenerate && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={onRegenerate}
              loading={regenerating}
            >
              <Dices className="h-4 w-4" />
              Neue Zeiten würfeln
            </Button>
          )}
          <Button variant="outline" className="min-w-0 flex-1" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Bearbeiten
          </Button>
          <Button
            variant="ghost"
            className="min-w-0 flex-1 text-danger hover:bg-danger-soft"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Löschen
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

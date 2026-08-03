import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Cat, Container, PawPrint, Scale, Square, Target, TriangleAlert, Utensils } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressBar, Skeleton } from '@/components/ui/Misc'
import { api } from '@/lib/api'
import { formatGrams, formatPercent } from '@/lib/format'
import { DEFAULT_TANK_WARN_PERCENT } from '@/lib/constants'
import { onFeedingCompleted, useFeeding, useSensor } from '@/stores/socketStore'
import { queryClient } from '@/App'
import { ManualFeedSheet } from './ManualFeedSheet'
import { TodayTimeline } from './TodayTimeline'
import { cn } from '@/lib/utils'

function tankColor(state: string | undefined): string {
  if (state === 'empty') return 'bg-danger'
  if (state === 'low') return 'bg-warning'
  return 'bg-success'
}

export default function DashboardPage() {
  const sensor = useSensor()
  const feeding = useFeeding()
  const [feedSheetOpen, setFeedSheetOpen] = useState(false)

  const today = useQuery({
    queryKey: ['today'],
    queryFn: api.getToday,
    refetchInterval: 30_000,
  })

  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })
  const warnPercent = settings.data?.tank_warn_percent ?? DEFAULT_TANK_WARN_PERCENT

  // Diät-Budget nur abfragen, wenn der Diät-Modus aktiv ist
  const diet = useQuery({
    queryKey: ['diet-status'],
    queryFn: api.getDietStatus,
    enabled: settings.data?.diet?.enabled === true,
    refetchInterval: 60_000,
  })

  // Live: frisst gerade jemand? Nur pollen, solange Futter im Napf liegt.
  // WICHTIG: liveEnabled auch beim Rendern prüfen - sonst friert die Zeile
  // mit dem letzten gecachten Ergebnis ein, sobald der Napf leer ist
  const liveEnabled = (sensor?.weight ?? 0) > 0.5
  const live = useQuery({
    queryKey: ['eating-live'],
    queryFn: api.getEatingLive,
    enabled: liveEnabled,
    refetchInterval: 5_000,
  })

  // Initial-Snapshot per REST, falls der Socket noch nicht geliefert hat
  const dashboardQuery = useQuery({
    queryKey: ['dashboard-initial'],
    queryFn: api.getDashboard,
    enabled: sensor === null,
    staleTime: Infinity,
  })
  const snapshot = sensor ?? dashboardQuery.data ?? null

  // Nach jeder abgeschlossenen Fütterung die Heute-Liste aktualisieren
  useEffect(
    () =>
      onFeedingCompleted(() => {
        queryClient.invalidateQueries({ queryKey: ['today'] })
        queryClient.invalidateQueries({ queryKey: ['diet-status'] })
      }),
    [],
  )

  const tank = snapshot?.tank
  const feedingActive = feeding?.active ?? false
  const showTankWarning =
    tank?.percent !== null && tank?.percent !== undefined && tank.percent < warnPercent

  // Nächste geplante Fütterung heute (Status offen, Zeit in der Zukunft)
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nextFeeding = today.data?.feedings.find((f) => {
    if (f.type === 'manual' || f.status !== null) return false
    const [h, m] = f.time.split(':').map(Number)
    return h * 60 + m > nowMinutes
  })

  return (
    <div className="space-y-3">
      {/* Hero: Live-Status - das Statement-Element mit Petrol-Schein */}
      <Card className="hero-card">
        <CardContent className="space-y-4">
          {!snapshot ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {/* Tank */}
              <div>
                <div className="flex items-center justify-between pb-1.5">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Container className="h-4 w-4" />
                    Tank
                  </span>
                  <span className="tnum text-2xl font-semibold tracking-tight">
                    {formatPercent(tank?.percent)}
                  </span>
                </div>
                <ProgressBar
                  value={tank?.percent ?? 0}
                  max={100}
                  className="h-2.5"
                  colorClass={tankColor(tank?.state)}
                />
                {typeof tank?.range_days === 'number' && (
                  <p className="tnum pt-1 text-xs text-muted-foreground">
                    reicht noch ~{tank.range_days.toFixed(1).replace(/\.0$/, '')} Tage
                  </p>
                )}
              </div>

              {/* Napf */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Scale className="h-4 w-4" />
                  Napf
                </span>
                <span className="tnum text-lg font-semibold">
                  {formatGrams(snapshot.weight)}
                </span>
              </div>

              {/* Heute */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Utensils className="h-4 w-4" />
                  Heute gefüttert
                </span>
                <span className="tnum text-lg font-semibold">
                  {formatGrams(snapshot.today_total)}
                </span>
              </div>

              {/* Live: wer frisst gerade? (Waagen-Signatur, ohne Kamera) */}
              {liveEnabled && live.data?.eating && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cat className="h-4 w-4" />
                    Am Napf
                  </span>
                  <span className="text-lg font-semibold">
                    {live.data.guess ? (
                      <>
                        {live.data.guess}
                        <span className="tnum text-sm font-normal text-muted-foreground">
                          {' '}~{Math.round((live.data.confidence ?? 0) * 100)} %
                          {' '}· {formatGrams(live.data.consumed)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-normal text-muted-foreground">
                        wird erkannt…
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Diät-Budget (nur bei aktivem Diät-Modus) */}
              {diet.data?.enabled && diet.data.budget_today !== null && (
                <div>
                  <div className="flex items-center justify-between pb-1.5">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Target className="h-4 w-4" />
                      Diät-Budget
                    </span>
                    <span className="tnum text-lg font-semibold">
                      {formatGrams(diet.data.remaining ?? 0)}
                      <span className="text-sm font-normal text-muted-foreground"> übrig</span>
                    </span>
                  </div>
                  <ProgressBar
                    value={diet.data.consumed_today}
                    max={diet.data.budget_today}
                    colorClass={
                      diet.data.consumed_today >= diet.data.budget_today
                        ? 'bg-danger'
                        : diet.data.consumed_today >= diet.data.budget_today * 0.9
                          ? 'bg-warning'
                          : 'bg-primary'
                    }
                  />
                  <p className="tnum pt-1 text-xs text-muted-foreground">
                    {formatGrams(diet.data.consumed_today)} von {formatGrams(diet.data.budget_today)}
                    {diet.data.at_target === false && ' · Rampe aktiv'}
                  </p>
                </div>
              )}

              {/* Nächste geplante Fütterung */}
              {nextFeeding && !feedingActive && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    Nächste Fütterung
                  </span>
                  <span className="tnum text-lg font-semibold">
                    {nextFeeding.time}
                    <span className="text-sm font-normal text-muted-foreground">
                      {' '}· {formatGrams(nextFeeding.planned_amount)}
                    </span>
                  </span>
                </div>
              )}

              {/* Laufende Fütterung */}
              {feedingActive && feeding && (
                <div className="rounded-md bg-primary-soft p-3">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-sm font-medium text-primary">
                      {feeding.source === 'manual' ? 'Manuelle Fütterung' : 'Plan-Fütterung'} läuft
                    </span>
                    <span className="tnum text-sm font-semibold text-primary">
                      {formatGrams(feeding.fed_grams)} / {formatGrams(feeding.target_grams)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar
                      value={feeding.fed_grams}
                      max={feeding.target_grams}
                      className="flex-1"
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => api.stopFeeding().catch(() => undefined)}
                    >
                      <Square className="h-3.5 w-3.5" />
                      Stopp
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tank-Warnung */}
      {showTankWarning && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3 text-sm',
            tank?.state === 'empty'
              ? 'border-danger/30 bg-danger-soft text-danger'
              : 'border-warning/30 bg-warning-soft text-warning',
          )}
        >
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">
              {tank?.state === 'empty' ? 'Tank fast leer!' : 'Füllstand niedrig'}
            </p>
            <p className="opacity-80">Bitte Futter nachfüllen ({formatPercent(tank?.percent)}).</p>
          </div>
        </div>
      )}

      {/* Füttern-Button */}
      <Button
        size="lg"
        className="w-full"
        onClick={() => setFeedSheetOpen(true)}
        disabled={feedingActive}
      >
        <PawPrint className="h-5 w-5" />
        {feedingActive ? 'Fütterung läuft…' : 'Füttern'}
      </Button>

      <TodayTimeline feedings={today.data?.feedings} loading={today.isLoading} />

      {/* Sheet nur für MANUELLE Fütterungen erzwingen - eine Plan-Fütterung darf
          den Nutzer nicht in ein nicht schliessbares Modal sperren (die Hero-Karte
          zeigt den Plan-Fortschritt inline) */}
      <ManualFeedSheet
        open={feedSheetOpen || (feedingActive && feeding?.source === 'manual')}
        onClose={() => setFeedSheetOpen(false)}
      />
    </div>
  )
}

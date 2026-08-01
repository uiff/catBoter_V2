import { useQuery } from '@tanstack/react-query'
import { FileHeart, HeartPulse, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { api } from '@/lib/api'
import { recommendedGramsPerDay } from '@/lib/calories'
import { cn } from '@/lib/utils'

/** ISO-String -> "DD.MM. HH:MM" */
function formatEntryTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '–'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Gesundheit: Fressverhalten aus der Napf-Waage (Dauer, letzte Berührung, Appetit, Wochenbilanz). */
export function HealthCard() {
  const health = useQuery({
    queryKey: ['health-stats'],
    queryFn: api.getHealthStats,
    refetchInterval: 60_000,
  })
  const daily = useQuery({ queryKey: ['daily', 7], queryFn: () => api.getDaily(7) })
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })

  const stats = health.data
  const recent = stats?.recent?.slice(0, 5) ?? []
  const appetite = stats?.appetite

  // Wochenbilanz: Summe der letzten 7 Tage vs. Empfehlung aus den Katzenprofilen
  const perDay = recommendedGramsPerDay(settings.data?.cat_profiles)
  const weekSum = daily.data
    ? Math.round(daily.data.slice(-7).reduce((sum, entry) => sum + entry.total, 0))
    : null
  const weekTarget = perDay !== null ? perDay * 7 : null
  const weekDeviation =
    weekSum !== null && weekTarget !== null && weekTarget > 0
      ? (weekSum - weekTarget) / weekTarget
      : null
  const weekWithinRange = weekDeviation !== null && Math.abs(weekDeviation) <= 0.15

  return (
    <Card>
      <CardHeader title="Gesundheit" icon={<HeartPulse className="h-4 w-4" />} />
      <CardContent className="space-y-3 pt-3">
        {health.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !stats ? (
          <EmptyState icon={HeartPulse} title="Noch keine Fressdaten" />
        ) : (
          <>
            {appetite &&
              appetite.baseline !== null &&
              (appetite.state === 'ok' ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Appetit</span>
                  <span className="font-medium text-success">unauffällig</span>
                </div>
              ) : (
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-md p-3 text-sm',
                    appetite.state === 'low'
                      ? 'bg-danger-soft text-danger'
                      : 'bg-warning-soft text-warning',
                  )}
                >
                  {appetite.state === 'low' ? (
                    <TrendingDown className="h-5 w-5 shrink-0" />
                  ) : (
                    <TrendingUp className="h-5 w-5 shrink-0" />
                  )}
                  <p className="tnum font-medium">
                    {appetite.state === 'low' ? 'Appetit-Rückgang' : 'Heisshunger'}: gestern{' '}
                    {Math.round(appetite.yesterday ?? 0)} g statt üblich ~
                    {Math.round(appetite.baseline)} g
                  </p>
                </div>
              ))}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ø Fresszeit</span>
              <span className="tnum font-medium">
                {stats.avg_minutes !== null ? `~${Math.round(stats.avg_minutes)} min` : '–'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Napf zuletzt berührt</span>
              <span className={cn('tnum font-medium', stats.untouched_hours > 8 && 'text-warning')}>
                vor {Math.round(stats.untouched_hours)} h
              </span>
            </div>

            {weekSum !== null && weekTarget !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Wochenbilanz</span>
                <span className="text-right">
                  <span
                    className={cn(
                      'tnum font-medium',
                      weekWithinRange ? 'text-success' : 'text-warning',
                    )}
                  >
                    {weekSum} / {weekTarget} g
                  </span>
                  {!weekWithinRange && weekDeviation !== null && (
                    <span className="block text-xs text-warning">
                      {weekDeviation < 0 ? 'zu wenig' : 'zu viel'}
                    </span>
                  )}
                </span>
              </div>
            )}

            {recent.length === 0 ? (
              <EmptyState icon={HeartPulse} title="Noch keine Fressdaten" />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {recent.map((entry, index) => (
                  <li
                    key={`${entry.ts}-${index}`}
                    className="tnum py-2.5 text-sm text-muted-foreground"
                  >
                    {formatEntryTime(entry.ts)} · in {Math.round(entry.minutes)} min leergefressen
                  </li>
                ))}
              </ul>
            )}

            <a
              href={api.vetReportUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FileHeart className="h-4 w-4" />
              Tierarzt-Bericht
            </a>

            <p className="text-xs text-muted-foreground">
              Werte umfassen beide Katzen gemeinsam.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

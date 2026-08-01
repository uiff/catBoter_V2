import { useQuery } from '@tanstack/react-query'
import { HeartPulse } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

/** ISO-String -> "DD.MM. HH:MM" */
function formatEntryTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '–'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Gesundheit: Fressverhalten aus der Napf-Waage (Dauer, letzte Berührung). */
export function HealthCard() {
  const health = useQuery({
    queryKey: ['health-stats'],
    queryFn: api.getHealthStats,
    refetchInterval: 60_000,
  })

  const stats = health.data
  const recent = stats?.recent?.slice(0, 5) ?? []

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
          </>
        )}
      </CardContent>
    </Card>
  )
}

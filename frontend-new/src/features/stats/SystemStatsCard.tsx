import { Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { ProgressBar, Skeleton } from '@/components/ui/Misc'
import { formatBytes, formatPercent } from '@/lib/format'
import type { SystemStats } from '@/types/api'
import { cn } from '@/lib/utils'

interface SystemStatsCardProps {
  stats: SystemStats | undefined
  loading: boolean
}

function diskColor(percent: number): string {
  if (percent > 90) return 'bg-danger'
  if (percent > 75) return 'bg-warning'
  return 'bg-primary'
}

/** Systemzustand: CPU, Temperatur, RAM und Speicherplatz. */
export function SystemStatsCard({ stats, loading }: SystemStatsCardProps) {
  return (
    <Card>
      <CardHeader title="System" icon={<Cpu className="h-4 w-4" />} />
      <CardContent className="space-y-3 pt-3">
        {loading && !stats ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : !stats ? null : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">CPU</span>
              <span className="tnum font-medium">{formatPercent(stats.cpu_percent)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Temperatur</span>
              <span
                className={cn(
                  'tnum font-medium',
                  stats.temperature !== null && stats.temperature > 70 && 'text-warning',
                )}
              >
                {stats.temperature !== null ? `${stats.temperature.toFixed(1)} °C` : '–'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">RAM</span>
              <span className="text-right">
                <span className="tnum font-medium">{formatPercent(stats.memory.percent)}</span>
                <span className="tnum block text-xs text-muted-foreground">
                  {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}
                </span>
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between pb-1.5 text-sm">
                <span className="text-muted-foreground">Speicher</span>
                <span className="text-right">
                  <span className="tnum font-medium">{formatPercent(stats.disk.percent)}</span>
                  <span className="tnum block text-xs text-muted-foreground">
                    {formatBytes(stats.disk.free)} frei
                  </span>
                </span>
              </div>
              <ProgressBar
                value={stats.disk.percent}
                max={100}
                colorClass={diskColor(stats.disk.percent)}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

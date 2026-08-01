import { ChartColumn, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { formatGrams } from '@/lib/format'
import type { DailyEntry } from '@/types/api'

interface TrendChartProps {
  entries: DailyEntry[] | undefined
  loading: boolean
  /** ISO-Datum (YYYY-MM-DD) des heutigen Tages - dieser Balken wird hervorgehoben. */
  todayDate: string
}

/** "2026-07-29" -> "Di 29." */
function formatDay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr
  const weekday = date.toLocaleDateString('de-CH', { weekday: 'short' }).replace('.', '')
  return `${weekday} ${date.getDate()}.`
}

export function TrendChart({ entries, loading, todayDate }: TrendChartProps) {
  return (
    <Card>
      <CardHeader title="Verlauf" icon={<TrendingUp className="h-4 w-4" />} />
      <CardContent className="pt-3">
        {loading && !entries ? (
          <Skeleton className="h-[180px] w-full" />
        ) : !entries || entries.length === 0 ? (
          <EmptyState icon={ChartColumn} title="Noch keine Daten" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={entries} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--chart-grid))" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDay}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'hsl(var(--chart-grid))', fillOpacity: 0.4 }}
                content={({ active, payload }) => {
                  const entry = payload?.[0]?.payload as DailyEntry | undefined
                  if (!active || !entry) return null
                  return (
                    <div className="rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-card">
                      <p className="font-medium">{formatDay(entry.date)}</p>
                      <p className="tnum text-muted-foreground">
                        {formatGrams(entry.total)} · {entry.feedings}{' '}
                        {entry.feedings === 1 ? 'Fütterung' : 'Fütterungen'}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}>
                {entries.map((entry) => (
                  <Cell key={entry.date} fillOpacity={entry.date === todayDate ? 1 : 0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

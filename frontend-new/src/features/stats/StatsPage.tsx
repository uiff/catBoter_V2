import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarRange, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/Misc'
import { api } from '@/lib/api'
import { formatGrams } from '@/lib/format'
import type { DailyEntry, TodayFeeding } from '@/types/api'
import { TodayTimeline } from '@/features/dashboard/TodayTimeline'
import { StatTile } from './StatTile'
import { TrendChart } from './TrendChart'
import { DayDetailSheet } from './DayDetailSheet'
import { SystemStatsCard } from './SystemStatsCard'
import { EventsCard } from './EventsCard'
import { HealthCard } from './HealthCard'
import { WeightCard } from './WeightCard'
import { EatingCard } from './EatingCard'

type Period = '7' | '30'

/** Lokales ISO-Datum (YYYY-MM-DD) - bewusst nicht toISOString(), das wäre UTC. */
function localIsoDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Zuverlässigkeit der Plan-Fütterungen heute:
 * fällig = keine manuelle UND (Uhrzeit vorbei ODER Status bereits gesetzt),
 * erfüllt = fällig mit status === true.
 */
function reliability(feedings: TodayFeeding[], now: Date) {
  const planned = feedings.filter((feeding) => {
    // Manuelle und Hand-Fütterungen sind nie "fällig" - sie zählen nicht
    // in die Zuverlässigkeit der Plan-Fütterungen
    if (feeding.type === 'manual' || feeding.type === 'hand') return false
    // Smart-Feed-Übersprungene zählen nicht als fällig (Napf war noch voll)
    if (feeding.skipped) return false
    if (feeding.status !== null) return true
    const [hours, minutes] = feeding.time.split(':').map(Number)
    const due = new Date(now)
    due.setHours(hours, minutes, 0, 0)
    return due <= now
  })
  const fulfilled = planned.filter((feeding) => feeding.status === true)
  return { planned: planned.length, fulfilled: fulfilled.length }
}

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('7')
  const [selectedDay, setSelectedDay] = useState<DailyEntry | null>(null)
  const days = period === '7' ? 7 : 30

  const daily = useQuery({
    queryKey: ['daily', days],
    queryFn: () => api.getDaily(days),
    placeholderData: keepPreviousData,
  })
  const today = useQuery({
    queryKey: ['today'],
    queryFn: api.getToday,
    refetchInterval: 30_000,
  })
  const systemStats = useQuery({
    queryKey: ['system-stats'],
    queryFn: api.getSystemStats,
    refetchInterval: 30_000,
  })

  const todayIso = today.data?.date ?? localIsoDate(new Date())
  const entries = daily.data ?? []

  // Ø pro Tag: nur abgeschlossene Tage (heute ausgenommen)
  const pastEntries = entries.filter((entry) => entry.date !== todayIso)
  const average =
    pastEntries.length > 0
      ? pastEntries.reduce((sum, entry) => sum + entry.total, 0) / pastEntries.length
      : null

  // Zuverlässigkeit heute
  const rel = today.data ? reliability(today.data.feedings, new Date()) : null

  // Min / Max der Tagessummen im Zeitraum - ohne den heutigen (unvollständigen)
  // Tag, sonst erscheint der angebrochene Tag morgens als "Minimum"
  const totals = pastEntries.map((entry) => entry.total)
  const minMax =
    totals.length > 0
      ? `${Math.round(Math.min(...totals))} / ${Math.round(Math.max(...totals))} g`
      : '–'

  const feedingCount = today.data?.feedings.length ?? 0

  // Wochenvergleich über KALENDER-Fenster (die Historie enthält nur Tage
  // mit Fütterungen - reines "letzte 7 Einträge" wäre verzerrt)
  const daily14 = useQuery({ queryKey: ['daily', 14], queryFn: () => api.getDaily(14) })
  const dayDiff = (date: string) =>
    Math.round((new Date(`${todayIso}T00:00:00`).getTime() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000)
  const sumWindow = (from: number, to: number) =>
    (daily14.data ?? [])
      .filter((entry) => dayDiff(entry.date) >= from && dayDiff(entry.date) <= to)
      .reduce((sum, entry) => sum + entry.total, 0)
  const weekNow = sumWindow(1, 6) + (today.data?.total ?? 0)
  const weekPrev = sumWindow(7, 13)
  const weekDelta = weekPrev > 0 ? ((weekNow - weekPrev) / weekPrev) * 100 : null
  const WeekIcon = weekDelta === null ? Minus : weekDelta > 3 ? TrendingUp : weekDelta < -3 ? TrendingDown : Minus

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Statistik</h1>
        <SegmentedControl<Period>
          className="w-44"
          options={[
            { value: '7', label: '7 Tage' },
            { value: '30', label: '30 Tage' },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          caption="Heute"
          value={today.data ? formatGrams(today.data.total) : '–'}
          sub={
            today.data
              ? `${feedingCount} ${feedingCount === 1 ? 'Fütterung' : 'Fütterungen'}`
              : undefined
          }
          loading={today.isLoading}
        />
        <StatTile caption="Ø pro Tag" value={formatGrams(average)} loading={daily.isLoading} />
        <StatTile
          caption="Zuverlässigkeit"
          value={
            rel && rel.planned > 0
              ? `${Math.round((rel.fulfilled / rel.planned) * 100)} %`
              : '–'
          }
          sub={rel ? (rel.planned > 0 ? `${rel.fulfilled}/${rel.planned}` : 'keine fälligen') : undefined}
          loading={today.isLoading}
        />
        <StatTile caption="Min / Max Tag" value={minMax} loading={daily.isLoading} />
      </div>

      {/* Wochenvergleich: 7 Kalendertage (inkl. heute) gegen die 7 davor */}
      {weekDelta !== null && (
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              Wochenvergleich
            </span>
            <span className="flex items-center gap-2">
              <span className="tnum font-semibold tracking-tight">{Math.round(weekNow)} g</span>
              <span className="tnum flex items-center gap-1 text-sm text-muted-foreground">
                <WeekIcon className="h-4 w-4" />
                {weekDelta > 0 ? '+' : ''}
                {Math.round(weekDelta)} % vs. Vorwoche
              </span>
            </span>
          </CardContent>
        </Card>
      )}

      <TrendChart
        entries={daily.data}
        loading={daily.isLoading}
        todayDate={todayIso}
        onDayClick={setSelectedDay}
      />

      {/* Listen-Karten aufklappbar (wie die System-Seite): Kennzahlen und
          Trend bleiben auf einen Blick, der Rest öffnet sich bei Bedarf */}
      <TodayTimeline feedings={today.data?.feedings} loading={today.isLoading} collapsible />

      <EventsCard />

      <HealthCard />

      <WeightCard />

      <EatingCard />

      <SystemStatsCard stats={systemStats.data} loading={systemStats.isLoading} />

      <DayDetailSheet entry={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  )
}

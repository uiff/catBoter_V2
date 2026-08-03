import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Weight, X } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, SegmentedControl, Skeleton } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'

const LINE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-3))']

/** "2026-08-03" -> "3.8." */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)}.${Number(m)}.`
}

/**
 * Gewichts-Tagebuch: Katzen wiegen, Verlauf sehen. Beim Eintragen zieht das
 * Backend das Profilgewicht mit - der Kalorienrechner bleibt aktuell.
 */
export function WeightCard() {
  const weights = useQuery({ queryKey: ['cat-weights'], queryFn: api.getCatWeights })
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })
  const [sheetOpen, setSheetOpen] = useState(false)

  const catNames = (settings.data?.cat_profiles?.cats ?? [])
    .map((cat) => cat.name)
    .filter(Boolean)
  const data = weights.data ?? {}

  // Gemeinsame Chart-Daten: eine Zeile je Datum, eine Spalte je Katze
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>()
    for (const [cat, entries] of Object.entries(data)) {
      for (const entry of entries) {
        const row = byDate.get(entry.date) ?? { date: entry.date }
        row[cat] = entry.kg
        byDate.set(entry.date, row)
      }
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [data])
  const hasChart = Object.values(data).some((entries) => entries.length >= 2)

  return (
    <CollapsibleCard title="Gewicht" icon={<Weight className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        {weights.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {catNames.map((name) => {
              const entries = data[name] ?? []
              const latest = entries[entries.length - 1]
              const previous = entries[entries.length - 2]
              const delta = latest && previous ? latest.kg - previous.kg : null
              return (
                <div key={name} className="flex min-h-6 items-center justify-between text-sm">
                  <span className="text-muted-foreground">{name}</span>
                  {latest ? (
                    <span className="text-right">
                      <span className="tnum font-semibold">{latest.kg.toFixed(2)} kg</span>
                      <span className="tnum block text-xs text-muted-foreground">
                        {shortDate(latest.date)}
                        {delta !== null &&
                          ` · ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} kg seit letzter Wiegung`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">noch nie gewogen</span>
                  )}
                </div>
              )
            })}

            {hasChart && (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-card">
                          <p className="font-medium">{shortDate(String(label))}</p>
                          {payload.map((item) => (
                            <p key={String(item.dataKey)} className="tnum text-muted-foreground">
                              {String(item.dataKey)}: {Number(item.value).toFixed(2)} kg
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  {catNames.map((name, index) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={LINE_COLORS[index % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}

            {!hasChart && catNames.every((name) => !(data[name] ?? []).length) && (
              <EmptyState
                icon={Weight}
                title="Noch keine Wiegungen"
                description="Regelmässiges Wiegen zeigt schleichende Veränderungen, lange bevor man sie sieht."
              />
            )}

            <Button variant="outline" className="w-full" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4" />
              Gewicht eintragen
            </Button>
          </>
        )}
      </div>

      <WeighSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        catNames={catNames}
        weights={data}
      />
    </CollapsibleCard>
  )
}

function WeighSheet({
  open,
  onClose,
  catNames,
  weights,
}: {
  open: boolean
  onClose: () => void
  catNames: string[]
  weights: Record<string, Array<{ date: string; kg: number }>>
}) {
  const [cat, setCat] = useState(catNames[0] ?? '')
  const [kgStr, setKgStr] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = cat || catNames[0] || ''
  const kg = Number(kgStr.replace(',', '.'))
  const valid = Number.isFinite(kg) && kg >= 0.5 && kg <= 20
  const recent = (weights[selected] ?? []).slice(-5).reverse()

  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await api.addCatWeight(selected, kg)
      toast.success(`${selected}: ${kg.toFixed(2)} kg eingetragen`)
      setKgStr('')
      queryClient.invalidateQueries({ queryKey: ['cat-weights'] })
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (date: string) => {
    try {
      await api.deleteCatWeight(selected, date)
      queryClient.invalidateQueries({ queryKey: ['cat-weights'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Löschen fehlgeschlagen')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Gewicht eintragen">
      <div className="space-y-4">
        {catNames.length > 1 && (
          <SegmentedControl
            options={catNames.map((name) => ({ value: name, label: name }))}
            value={selected}
            onChange={setCat}
          />
        )}
        <Input
          label="Gewicht"
          type="number"
          inputMode="decimal"
          step="0.05"
          min={0.5}
          max={20}
          suffix="kg"
          className="tnum"
          placeholder="z. B. 4.35"
          value={kgStr}
          onChange={(e) => setKgStr(e.target.value)}
        />
        <Button className="w-full" onClick={save} disabled={!valid} loading={saving}>
          Speichern
        </Button>

        {recent.length > 0 && (
          <div>
            <p className="pb-1 text-sm font-medium">Letzte Wiegungen</p>
            <ul className="divide-y divide-border">
              {recent.map((entry) => (
                <li key={entry.date} className="flex items-center justify-between py-2 text-sm">
                  <span className="tnum text-muted-foreground">{entry.date}</span>
                  <span className="flex items-center gap-2">
                    <span className="tnum font-medium">{entry.kg.toFixed(2)} kg</span>
                    <button
                      onClick={() => remove(entry.date)}
                      aria-label={`Wiegung vom ${entry.date} löschen`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Der Eintrag aktualisiert auch das Profilgewicht - die Kalorienempfehlung
          rechnet immer mit dem aktuellen Wert. Tipp: mit Personenwaage erst dich,
          dann dich mit Katze wiegen.
        </p>
      </div>
    </Sheet>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Container, Ruler } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { formatCm, formatPercent } from '@/lib/format'
import { queryClient } from '@/App'

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/** Vordefinierte Tank-Grössen (der Tank ist modular aufbaubar):
 *  Leer-Distanz vom Sensor bis zum Boden je Variante. */
const TANK_PRESETS = [
  { key: 'gross', label: 'Grosser Tank', emptyCm: 55 },
  { key: 'klein', label: 'Kleiner Tank', emptyCm: 31 },
] as const

/**
 * Tank-Kalibrierung als Mess-Assistent: Tankhöhe ist modular - im Messmodus
 * werden Live-Distanzen direkt als "voll"/"leer" übernommen.
 */
export function TankCard() {
  const calibration = useQuery({ queryKey: ['tank-calibration'], queryFn: api.getTankCalibration })

  const [measuring, setMeasuring] = useState(false)
  const [minStr, setMinStr] = useState('')
  const [maxStr, setMaxStr] = useState('')
  const [saving, setSaving] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && calibration.data) {
      initialized.current = true
      setMinStr(calibration.data.min_distance.toFixed(1))
      setMaxStr(calibration.data.max_distance.toFixed(1))
    }
  }, [calibration.data])

  // Frische Live-Distanz nur im Messmodus abfragen
  const live = useQuery({
    queryKey: ['distance-live'],
    queryFn: () => api.getDistance(true),
    refetchInterval: 2000,
    enabled: measuring,
    retry: false,
  })

  const min = Number.parseFloat(minStr)
  const max = Number.parseFloat(maxStr)
  const parsed = Number.isFinite(min) && Number.isFinite(max)
  const orderOk = parsed && min >= 0 && min < max

  const liveDistance = measuring ? live.data?.distance_cm ?? null : null
  const preview =
    orderOk && liveDistance !== null
      ? clampPercent(((max - liveDistance) / (max - min)) * 100)
      : null

  const capture = (field: 'min' | 'max') => {
    if (liveDistance === null) return
    if (field === 'min') setMinStr(liveDistance.toFixed(1))
    else setMaxStr(liveDistance.toFixed(1))
  }

  const save = async () => {
    if (!orderOk) return
    setSaving(true)
    try {
      await api.setTankCalibration({ min_distance: min, max_distance: max })
      toast.success('Tank-Kalibrierung gespeichert')
      queryClient.invalidateQueries({ queryKey: ['tank-calibration'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Tank" icon={<Container className="h-4 w-4" />} />
      <CardContent className="space-y-3">
        {calibration.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            {/* Schnellwahl der Tank-Variante: setzt die Leer-Distanz des Aufbaus */}
            <div>
              <p className="pb-2 text-sm font-medium">Tank-Variante</p>
              <div className="grid grid-cols-2 gap-2">
                {TANK_PRESETS.map((preset) => {
                  const active = Number.parseFloat(maxStr) === preset.emptyCm
                  return (
                    <button
                      key={preset.key}
                      onClick={() => setMaxStr(preset.emptyCm.toFixed(1))}
                      className={
                        active
                          ? 'rounded-md border border-primary bg-primary-soft px-3 py-2.5 text-sm font-medium text-primary'
                          : 'rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium hover:bg-surface-2'
                      }
                    >
                      {preset.label}
                      <span className="tnum block text-xs font-normal text-muted-foreground">
                        {preset.emptyCm} cm
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setMeasuring((m) => !m)}
            >
              <Ruler className="h-4 w-4" />
              {measuring ? 'Messmodus beenden' : 'Messmodus starten'}
            </Button>

            {measuring && (
              <div className="space-y-3 rounded-md bg-surface-2 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Aktuelle Distanz</span>
                  <span className="tnum font-semibold">{formatCm(liveDistance)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Aktueller Füllstand</span>
                  <span className="tnum font-semibold">
                    {formatPercent(measuring ? live.data?.percent ?? null : null)}
                  </span>
                </div>
                {live.isError && (
                  <p className="text-xs text-danger">
                    {live.error instanceof ApiError
                      ? live.error.message
                      : 'Distanzmessung fehlgeschlagen'}
                  </p>
                )}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full bg-surface"
                    onClick={() => capture('min')}
                    disabled={liveDistance === null}
                  >
                    Aktuell = voll übernehmen
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full bg-surface"
                    onClick={() => capture('max')}
                    disabled={liveDistance === null}
                  >
                    Aktuell = leer übernehmen
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Voll (min. Distanz)"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                suffix="cm"
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
              />
              <Input
                label="Leer (max. Distanz)"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                suffix="cm"
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
              />
            </div>

            {parsed && !orderOk && (
              <p className="text-sm text-danger">
                Die Voll-Distanz muss kleiner als die Leer-Distanz sein.
              </p>
            )}

            {preview !== null && (
              <p className="text-sm text-muted-foreground">
                Vorschau mit dieser Kalibrierung:{' '}
                <span className="tnum font-medium text-foreground">{formatPercent(preview)}</span>
              </p>
            )}

            <Button className="w-full" onClick={save} loading={saving} disabled={!orderOk}>
              Speichern
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

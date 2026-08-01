import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Target } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton, Stepper, Switch } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { recommendedGramsPerDay } from '@/lib/calories'
import { queryClient } from '@/App'

/**
 * Diät-Modus: Tages-Budget für den Haushalt (beide Katzen zusammen) mit
 * sanfter Rampe. Plan-Fütterungen werden aufs Rest-Budget gekappt; manuelle
 * und Hand-Fütterungen zählen mit, werden aber nur gewarnt, nicht blockiert.
 */
export function DietCard() {
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })
  const status = useQuery({ queryKey: ['diet-status'], queryFn: api.getDietStatus })

  const [enabled, setEnabled] = useState(false)
  const [targetStr, setTargetStr] = useState('')
  const [startStr, setStartStr] = useState('')
  const [weeklyPct, setWeeklyPct] = useState(5)
  const [saving, setSaving] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && settings.data) {
      initialized.current = true
      const diet = settings.data.diet
      if (diet) {
        setEnabled(diet.enabled)
        setTargetStr(diet.target_grams !== null ? String(diet.target_grams) : '')
        setStartStr(diet.start_grams !== null ? String(diet.start_grams) : '')
        setWeeklyPct(diet.weekly_reduction_pct ?? 5)
      }
    }
  }, [settings.data])

  const target = targetStr === '' ? null : Number.parseFloat(targetStr)
  const start = startStr === '' ? null : Number.parseFloat(startStr)
  const targetOk = target === null || (Number.isFinite(target) && target >= 5 && target <= 200)
  const startOk =
    start === null ||
    (Number.isFinite(start) && start >= 5 && start <= 300 && (target === null || start >= target))
  const valid = targetOk && startOk && (!enabled || target !== null)

  // Empfehlung aus den Katzenprofilen als Orientierung fürs Tagesziel
  const recommended = recommendedGramsPerDay(settings.data?.cat_profiles)

  const saved = settings.data?.diet
  const changed = saved
    ? enabled !== saved.enabled ||
      target !== saved.target_grams ||
      start !== saved.start_grams ||
      weeklyPct !== saved.weekly_reduction_pct
    : false

  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await api.setAppSettings({
        diet: {
          enabled,
          target_grams: target,
          start_grams: start,
          weekly_reduction_pct: weeklyPct,
          start_date: saved?.start_date ?? null,
        },
      })
      toast.success('Diät-Einstellungen gespeichert')
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
      queryClient.invalidateQueries({ queryKey: ['diet-status'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleCard title="Diät" icon={<Target className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        {settings.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm font-medium">Diät-Modus aktiv</span>
              <Switch checked={enabled} onChange={setEnabled} label="Diät-Modus aktiv" />
            </div>

            {/* Aktueller Stand aus dem Backend (Rampe kann über dem Ziel liegen) */}
            {status.data?.enabled && status.data.budget_today !== null && (
              <div className="tnum rounded-md bg-surface-2 p-3 text-sm">
                Budget heute: <span className="font-semibold">{status.data.budget_today} g</span>
                {status.data.at_target === false && status.data.target_grams !== null && (
                  <span className="text-muted-foreground">
                    {' '}· Rampe läuft, Ziel {status.data.target_grams} g
                  </span>
                )}
              </div>
            )}

            <Input
              label="Tagesziel"
              type="number"
              inputMode="decimal"
              min={5}
              max={200}
              suffix="g"
              placeholder={recommended !== null ? `Empfehlung ~${recommended}` : 'z. B. 50'}
              value={targetStr}
              onChange={(e) => setTargetStr(e.target.value)}
            />
            <Input
              label="Startmenge (aktueller Verbrauch)"
              type="number"
              inputMode="decimal"
              min={5}
              max={300}
              suffix="g"
              placeholder="leer = sofort aufs Ziel"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
            />
            <div>
              <p className="pb-2 text-sm font-medium">Reduktion pro Woche</p>
              <Stepper value={weeklyPct} onChange={setWeeklyPct} min={0} max={5} step={1} suffix="%" />
            </div>

            {!targetOk && (
              <p className="text-sm text-danger">Tagesziel muss zwischen 5 und 200 g liegen.</p>
            )}
            {!startOk && (
              <p className="text-sm text-danger">
                Startmenge muss über dem Tagesziel liegen (5-300 g).
              </p>
            )}
            {enabled && target === null && (
              <p className="text-sm text-danger">Für den Diät-Modus braucht es ein Tagesziel.</p>
            )}

            <Button className="w-full" onClick={save} disabled={!changed || !valid} loading={saving}>
              Speichern
            </Button>

            <p className="text-xs text-muted-foreground">
              Maximal 5 % Reduktion pro Woche - schnelleres Abnehmen ist für Katzen gefährlich
              (Leberverfettung). Das Budget gilt für beide Katzen zusammen; Plan-Fütterungen
              werden gekappt, manuelle nur gewarnt. Richtwert - Tierarzt konsultieren.
            </p>
          </>
        )}
      </div>
    </CollapsibleCard>
  )
}

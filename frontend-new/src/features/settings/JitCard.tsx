import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { Skeleton, Stepper, Switch } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'

/**
 * Just-in-Time-Fütterung: Napf bleibt leer, Häppchen kommen nur, solange die
 * live erkannte Katze noch Tagesbudget hat (Budgets in den Katzenprofilen).
 * Greift erst, wenn die Erkennung fertig gelernt hat - bis dahin normale
 * Fütterung, das Aktivieren ist also jederzeit gefahrlos.
 */
export function JitCard() {
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })
  const eating = useQuery({ queryKey: ['eating-data'], queryFn: () => api.getEatingData(7) })

  const [enabled, setEnabled] = useState(false)
  const [starter, setStarter] = useState(3)
  const [saving, setSaving] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && settings.data) {
      initialized.current = true
      const jit = settings.data.jit
      if (jit) {
        setEnabled(jit.enabled)
        setStarter(jit.starter_grams ?? 3)
      }
    }
  }, [settings.data])

  const saved = settings.data?.jit
  const changed = saved ? enabled !== saved.enabled || starter !== saved.starter_grams : false
  const classifierActive = eating.data?.classifier.active ?? false

  const save = async () => {
    setSaving(true)
    try {
      await api.setAppSettings({ jit: { enabled, starter_grams: starter } })
      toast.success('Einstellungen gespeichert')
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleCard title="Pro-Katze-Fütterung" icon={<UtensilsCrossed className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        {settings.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm font-medium">Just-in-Time-Dosierung</span>
              <Switch checked={enabled} onChange={setEnabled} label="Just-in-Time-Dosierung" />
            </div>

            {/* Status-Banner spiegeln den GESPEICHERTEN Zustand, nicht die
                ungespeicherte Eingabe - sonst behauptet die Karte "aktiv",
                bevor je gespeichert wurde */}
            {saved?.enabled && !classifierActive && (
              <div className="rounded-md bg-info-soft p-3 text-sm text-info">
                Die Erkennung ist noch in der Lernphase - bis sie fertig gelernt hat
                (8 Mahlzeiten je Katze labeln), läuft die Fütterung normal weiter.
              </div>
            )}
            {saved?.enabled && classifierActive && (
              <div className="rounded-md bg-success-soft p-3 text-sm text-success">
                Erkennung aktiv - Plan-Fütterungen dosieren jetzt pro Katze.
              </div>
            )}

            <div>
              <p className="pb-2 text-sm font-medium">Starter-Häppchen</p>
              <Stepper value={starter} onChange={setStarter} min={3} max={5} step={1} suffix="g" />
            </div>

            <Button className="w-full" onClick={save} disabled={!changed} loading={saving}>
              Speichern
            </Button>

            <p className="text-xs text-muted-foreground">
              So funktioniert es: Zur Fütterungszeit fällt nur das Starter-Häppchen in den
              Napf. Die Waage erkennt am Fressverhalten, welche Katze frisst, und dosiert
              nur nach, solange deren Tagesbudget (Katzenprofile) nicht erreicht ist. Bei
              Unsicherheit wird IMMER dosiert, und unterhalb der Mindestmenge wird nie
              gesperrt - Erkennungsfehler kosten Gramm, nie Mahlzeiten.
            </p>
          </>
        )}
      </div>
    </CollapsibleCard>
  )
}

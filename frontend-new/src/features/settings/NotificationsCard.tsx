import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton, Stepper } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { DEFAULT_TANK_WARN_PERCENT } from '@/lib/constants'
import { queryClient } from '@/App'

/** Benachrichtigungen: Tank-Warnschwelle (Backend-Einstellung). */
export function NotificationsCard() {
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })

  const [warnPercent, setWarnPercent] = useState<number>(DEFAULT_TANK_WARN_PERCENT)
  const [saving, setSaving] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && settings.data) {
      initialized.current = true
      setWarnPercent(settings.data.tank_warn_percent)
    }
  }, [settings.data])

  const changed = settings.data !== undefined && warnPercent !== settings.data.tank_warn_percent

  const save = async () => {
    setSaving(true)
    try {
      await api.setAppSettings({ tank_warn_percent: warnPercent })
      toast.success('Einstellungen gespeichert')
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Benachrichtigungen" icon={<Bell className="h-4 w-4" />} />
      <CardContent className="space-y-3">
        {settings.isLoading ? (
          <Skeleton className="h-11 w-full" />
        ) : (
          <>
            <div>
              <p className="pb-2 text-sm font-medium">Tank-Warnschwelle</p>
              <Stepper
                value={warnPercent}
                onChange={setWarnPercent}
                min={5}
                max={90}
                step={5}
                suffix="%"
              />
              <p className="pt-1.5 text-xs text-muted-foreground">
                Warnung erscheint, wenn der Füllstand unter diesen Wert fällt.
              </p>
            </div>
            <Button className="w-full" onClick={save} disabled={!changed} loading={saving}>
              Speichern
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

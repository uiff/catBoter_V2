import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton, Stepper, Switch } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { DEFAULT_TANK_WARN_PERCENT } from '@/lib/constants'
import { queryClient } from '@/App'

/** VAPID-Public-Key (base64url) -> Uint8Array für pushManager.subscribe(). */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

const PUSH_SUPPORTED =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

/** Benachrichtigungen: Tank-Warnschwelle, Unberührt-Warnung und Web-Push. */
export function NotificationsCard() {
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })

  const [warnPercent, setWarnPercent] = useState<number>(DEFAULT_TANK_WARN_PERCENT)
  const [untouchedHours, setUntouchedHours] = useState(0)
  const [saving, setSaving] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && settings.data) {
      initialized.current = true
      setWarnPercent(settings.data.tank_warn_percent)
      setUntouchedHours(settings.data.untouched_alert_hours ?? 0)
    }
  }, [settings.data])

  const changed =
    settings.data !== undefined &&
    (warnPercent !== settings.data.tank_warn_percent ||
      untouchedHours !== (settings.data.untouched_alert_hours ?? 0))

  const save = async () => {
    setSaving(true)
    try {
      await api.setAppSettings({
        tank_warn_percent: warnPercent,
        untouched_alert_hours: untouchedHours,
      })
      toast.success('Einstellungen gespeichert')
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  /* ------------------------------- Web-Push ------------------------------- */

  const [subscribed, setSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!PUSH_SUPPORTED) return
    let cancelled = false
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setSubscribed(sub !== null)
      })
      .catch(() => {
        /* Service Worker nicht bereit - Schalter bleibt aus */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enablePush = async () => {
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setSubscribed(false)
        toast.error('Benachrichtigungen im Browser blockiert')
        return
      }
      const { public_key } = await api.getPushPublicKey()
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      })
      await api.pushSubscribe(sub.toJSON())
      setSubscribed(true)
      toast.success('Push aktiviert')
    } catch (e) {
      setSubscribed(false)
      toast.error(e instanceof ApiError ? e.message : 'Push-Aktivierung fehlgeschlagen')
    } finally {
      setPushBusy(false)
    }
  }

  const disablePush = async () => {
    setPushBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await api.pushUnsubscribe(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
      toast.success('Push deaktiviert')
    } catch (e) {
      setSubscribed(true) // zurück auf den echten Zustand
      toast.error(e instanceof ApiError ? e.message : 'Push-Deaktivierung fehlgeschlagen')
    } finally {
      setPushBusy(false)
    }
  }

  const togglePush = (value: boolean) => {
    setSubscribed(value) // optimistisch - die Flows setzen bei Fehlern zurück
    if (value) void enablePush()
    else void disablePush()
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      const res = await api.pushTest()
      toast.success(
        `Test gesendet – ${res.delivered} ${res.delivered === 1 ? 'Gerät' : 'Geräte'} erreicht`,
      )
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Test fehlgeschlagen')
    } finally {
      setTesting(false)
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
            <div>
              <p className="pb-2 text-sm font-medium">Unberührt-Warnung</p>
              <Stepper
                value={untouchedHours}
                onChange={setUntouchedHours}
                min={0}
                max={72}
                step={6}
                suffix="h"
              />
              <p className="pt-1.5 text-xs text-muted-foreground">
                Warnt, wenn der volle Napf so lange nicht angerührt wird (0 = aus).
              </p>
            </div>
            <Button className="w-full" onClick={save} disabled={!changed} loading={saving}>
              Speichern
            </Button>
          </>
        )}

        {/* Web-Push */}
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-sm font-medium">Push-Benachrichtigungen</p>
          {!PUSH_SUPPORTED ? (
            <p className="text-xs text-muted-foreground">
              Push wird von diesem Browser nicht unterstützt.
            </p>
          ) : (
            <>
              <div className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-sm font-medium">Push aktivieren</span>
                <Switch
                  checked={subscribed}
                  onChange={togglePush}
                  label="Push aktivieren"
                  disabled={pushBusy}
                />
              </div>
              {subscribed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={sendTest}
                  loading={testing}
                  className="w-full"
                >
                  <Send className="h-4 w-4" />
                  Test senden
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Push funktioniert nur, solange der CatBoter Internet hat.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

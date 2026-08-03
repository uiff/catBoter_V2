import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RadioTower } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Skeleton, Stepper, Switch } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'
import type { FallbackConfig } from '@/types/api'

type ApAction = 'start' | 'stop'

/** Notfall-Hotspot: Status des Host-Services, Konfiguration und manueller Start/Stopp. */
export function ApFallbackCard() {
  const status = useQuery({
    queryKey: ['fallback'],
    queryFn: api.getFallbackStatus,
    refetchInterval: 30_000,
  })
  const config = useQuery({ queryKey: ['fallback-config'], queryFn: api.getFallbackConfig })

  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [channel, setChannel] = useState(6)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<ApAction | null>(null)
  const [apBusy, setApBusy] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  // Das gespeicherte Passwort wird nie angezeigt (Feld bleibt leer = unverändert).
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && config.data) {
      initialized.current = true
      setSsid(config.data.ssid)
      setChannel(config.data.channel)
      setEnabled(config.data.enabled)
    }
  }, [config.data])

  const changed = config.data
    ? ssid !== config.data.ssid ||
      channel !== config.data.channel ||
      enabled !== config.data.enabled ||
      password !== ''
    : false

  const save = async () => {
    if (!config.data || !changed) return
    // Nur geänderte Felder senden; Passwort nur, wenn eines eingegeben wurde
    const payload: Partial<FallbackConfig> = {}
    if (ssid !== config.data.ssid) payload.ssid = ssid
    if (channel !== config.data.channel) payload.channel = channel
    if (enabled !== config.data.enabled) payload.enabled = enabled
    if (password !== '') payload.password = password

    setSaving(true)
    try {
      const res = await api.setFallbackConfig(payload)
      toast.success(res.message || 'Konfiguration gespeichert')
      setPassword('')
      queryClient.invalidateQueries({ queryKey: ['fallback-config'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const runApAction = async () => {
    if (!confirm) return
    setApBusy(true)
    try {
      if (confirm === 'start') await api.enableAp()
      else await api.disableAp()
      toast.success('Befehl an Host-Service übergeben')
      setConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Befehl fehlgeschlagen')
    } finally {
      setApBusy(false)
    }
  }

  const serviceRunning = status.data?.service_running ?? false

  return (
    <CollapsibleCard title="Notfall-Hotspot" icon={<RadioTower className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        {/* Status */}
        {status.isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : !serviceRunning ? (
          <div className="rounded-md bg-info-soft p-3 text-sm text-info">
            Host-Service läuft nicht
            {status.data?.message ? ` – ${status.data.message}` : ''}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Netzwerk verbunden</span>
              <span className="font-medium">{status.data?.network_connected ? 'Ja' : 'Nein'}</span>
            </div>
            <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Hotspot aktiv</span>
              <span className="font-medium">{status.data?.ap_active ? 'Ja' : 'Nein'}</span>
            </div>
            {status.data?.ap_password && (
              <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Hotspot-Passwort</span>
                <span className="font-mono font-medium">{status.data.ap_password}</span>
              </div>
            )}
          </div>
        )}

        {/* Konfiguration */}
        {config.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : config.data ? (
          <div className="space-y-3">
            <Input
              label="SSID"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              autoComplete="off"
            />
            <Input
              label="Passwort"
              type="password"
              placeholder="unverändert"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div>
              <p className="pb-2 text-sm font-medium">Kanal</p>
              <Stepper value={channel} onChange={setChannel} min={1} max={13} />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm font-medium">Automatischer Fallback aktiv</span>
              <Switch checked={enabled} onChange={setEnabled} label="Automatischer Fallback aktiv" />
            </div>
            <Button className="w-full" onClick={save} loading={saving} disabled={!changed}>
              Speichern
            </Button>
          </div>
        ) : null}

        {/* Manueller Start/Stopp */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setConfirm('start')}
            disabled={!serviceRunning}
          >
            Hotspot starten
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setConfirm('stop')}
            disabled={!serviceRunning}
          >
            Hotspot stoppen
          </Button>
        </div>
      </div>

      <ConfirmSheet
        open={confirm === 'start'}
        onClose={() => setConfirm(null)}
        onConfirm={runApAction}
        title="Hotspot starten"
        description="Beim Start des Hotspots wird die bestehende WLAN-Verbindung getrennt. Das Gerät ist danach nur noch über den Hotspot erreichbar."
        confirmLabel="Hotspot starten"
        danger
        loading={apBusy}
      />
      <ConfirmSheet
        open={confirm === 'stop'}
        onClose={() => setConfirm(null)}
        onConfirm={runApAction}
        title="Hotspot stoppen"
        description="Der Notfall-Hotspot wird beendet. Geräte, die darüber verbunden sind, verlieren die Verbindung."
        confirmLabel="Hotspot stoppen"
        loading={apBusy}
      />
    </CollapsibleCard>
  )
}

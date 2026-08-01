import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plug } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton, Switch } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'
import type { MqttSettings } from '@/types/api'

/** Fallback, falls das Backend (noch) keine MQTT-Einstellungen liefert. */
const DEFAULT_MQTT: MqttSettings = {
  enabled: false,
  host: '',
  port: 1883,
  username: '',
  password: '',
}

/** Integrationen: MQTT-Broker und Home-Assistant-Discovery. */
export function IntegrationsCard() {
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })

  const [enabled, setEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState(1883)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [haDiscovery, setHaDiscovery] = useState(false)
  const [saving, setSaving] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  // Das gespeicherte Passwort wird nie angezeigt (Feld bleibt leer = unverändert).
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && settings.data) {
      initialized.current = true
      const mqtt = settings.data.mqtt ?? DEFAULT_MQTT
      setEnabled(mqtt.enabled)
      setHost(mqtt.host)
      setPort(mqtt.port)
      setUsername(mqtt.username)
      setHaDiscovery(settings.data.ha_discovery ?? false)
    }
  }, [settings.data])

  const saved = settings.data?.mqtt ?? DEFAULT_MQTT
  const changed = settings.data
    ? enabled !== saved.enabled ||
      host !== saved.host ||
      port !== saved.port ||
      username !== saved.username ||
      haDiscovery !== (settings.data.ha_discovery ?? false) ||
      password !== ''
    : false

  const save = async () => {
    // Passwort nur mitsenden, wenn eines eingegeben wurde (leer = unverändert)
    const mqtt: Partial<MqttSettings> = { enabled, host, port, username }
    if (password !== '') mqtt.password = password

    setSaving(true)
    try {
      await api.setAppSettings({ mqtt, ha_discovery: haDiscovery })
      toast.success('Einstellungen gespeichert')
      setPassword('')
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Integrationen" icon={<Plug className="h-4 w-4" />} />
      <CardContent className="space-y-3">
        {settings.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm font-medium">MQTT aktivieren</span>
              <Switch checked={enabled} onChange={setEnabled} label="MQTT aktivieren" />
            </div>
            <Input
              label="Host"
              placeholder="z. B. 192.168.1.10"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              autoComplete="off"
            />
            <Input
              label="Port"
              type="number"
              min={1}
              max={65535}
              className="tnum"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
            />
            <Input
              label="Benutzername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm font-medium">Home-Assistant-Discovery</span>
              <Switch
                checked={haDiscovery}
                onChange={setHaDiscovery}
                label="Home-Assistant-Discovery"
              />
            </div>
            <Button className="w-full" onClick={save} disabled={!changed} loading={saving}>
              Speichern
            </Button>

            {/* break-all: lange Code-Strings dürfen die Karte nie breiter als
                den Viewport machen (verursachte horizontales Seiten-Scrollen) */}
            <div className="min-w-0 space-y-1 whitespace-pre-wrap break-all rounded-md bg-surface-2 p-3 font-mono text-xs">
              <p>catboter/status – Zustand (JSON, retained)</p>
              <p>catboter/command – Steuerung: {'{"action":"feed","grams":10}'}</p>
              <p>catboter/event – Ereignisse</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

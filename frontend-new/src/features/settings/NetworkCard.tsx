import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cable, Lock, SignalHigh, SignalLow, SignalMedium, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'
import type { WifiNetwork } from '@/types/api'

/** Signalstärke-Icon nach dBm-Schwellen (>= -55 gut, >= -70 mittel, sonst schwach). */
function SignalIcon({ dbm, className }: { dbm: number | null; className?: string }) {
  const Icon =
    dbm === null ? SignalLow : dbm >= -55 ? SignalHigh : dbm >= -70 ? SignalMedium : SignalLow
  return <Icon className={className} />
}

/** WLAN: aktueller Status, Netzwerk-Scan und Verbindungsaufbau. */
export function NetworkCard() {
  const network = useQuery({ queryKey: ['network'], queryFn: api.getNetworkInfo })
  const scan = useQuery({
    queryKey: ['wifi-scan'],
    queryFn: api.scanWifi,
    enabled: false,
    retry: false,
    staleTime: Infinity,
  })
  const [selected, setSelected] = useState<WifiNetwork | null>(null)

  const startScan = async () => {
    const result = await scan.refetch()
    if (result.error) {
      toast.error(result.error instanceof ApiError ? result.error.message : 'Scan fehlgeschlagen')
    }
  }

  const info = network.data

  const eth = info?.interfaces?.eth0

  return (
    <CollapsibleCard title="Netzwerk" icon={<Wifi className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        {network.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Netzwerk</span>
              <span className="truncate font-medium">{info?.wifi_ssid ?? 'Nicht verbunden'}</span>
            </div>
            <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">IP-Adresse</span>
              <span className="tnum font-medium">{info?.current_ip ?? '–'}</span>
            </div>
            <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Signal</span>
              <span className="flex items-center gap-1.5 font-medium">
                <SignalIcon dbm={info?.wifi_signal_dbm ?? null} className="h-4 w-4 text-muted-foreground" />
                <span className="tnum">
                  {info?.wifi_signal_dbm !== null && info?.wifi_signal_dbm !== undefined
                    ? `${info.wifi_signal_dbm} dBm`
                    : '–'}
                </span>
              </span>
            </div>
            <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Cable className="h-4 w-4" />
                Ethernet
              </span>
              <span className="tnum font-medium">
                {eth?.ip ? eth.ip : eth?.up ? 'Verbunden' : 'Nicht verbunden'}
              </span>
            </div>
          </div>
        )}

        <Button variant="secondary" className="w-full" onClick={startScan} loading={scan.isFetching}>
          {scan.isFetching ? 'Suche läuft…' : 'Netzwerke suchen'}
        </Button>
        {scan.isFetching && (
          <p className="text-xs text-muted-foreground">Der Scan kann bis zu 15 Sekunden dauern.</p>
        )}

        {scan.data && !scan.isFetching && (
          <div className="divide-y divide-border rounded-md border border-border">
            {scan.data.networks.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Keine Netzwerke gefunden.</p>
            ) : (
              scan.data.networks.map((net, index) => (
                <button
                  key={`${net.ssid}-${index}`}
                  onClick={() => setSelected(net)}
                  className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <SignalIcon dbm={net.signal_dbm} className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm font-medium">{net.ssid}</span>
                  {net.signal_dbm !== null && (
                    <span className="tnum text-xs text-muted-foreground">{net.signal_dbm} dBm</span>
                  )}
                  {net.encrypted && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <ConnectSheet network={selected} onClose={() => setSelected(null)} />
    </CollapsibleCard>
  )
}

/** Verbindungsaufbau zu einem gescannten Netzwerk. */
function ConnectSheet({ network, onClose }: { network: WifiNetwork | null; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)

  // Passwortfeld pro Netzwerk zurücksetzen
  useEffect(() => {
    setPassword('')
  }, [network])

  const connect = async () => {
    if (!network) return
    setConnecting(true)
    try {
      const res = await api.connectWifi(network.ssid, password)
      if (res.success) {
        toast.success(res.message || `Mit ${network.ssid} verbunden`)
        queryClient.invalidateQueries({ queryKey: ['network'] })
        onClose()
      } else {
        toast.error(res.message || 'Verbindung fehlgeschlagen')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Verbindung fehlgeschlagen')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Sheet open={network !== null} onClose={onClose} title="WLAN verbinden">
      {network && (
        <div className="space-y-4">
          <Input label="Netzwerk" value={network.ssid} readOnly />
          {network.encrypted && (
            <Input
              label="Passwort"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={connect}
            loading={connecting}
            disabled={network.encrypted && password.length === 0}
          >
            Verbinden
          </Button>
          <p className="text-xs text-muted-foreground">
            Der Verbindungsversuch kann bis zu 45 Sekunden dauern. Bei einem Netzwerkwechsel ist das
            Gerät danach unter einer neuen IP-Adresse erreichbar.
          </p>
        </div>
      )}
    </Sheet>
  )
}

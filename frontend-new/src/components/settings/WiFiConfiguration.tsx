import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, RefreshCw, Lock, LockOpen, Signal, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

interface NetworkInfo {
  current_ip: string
  wifi_ssid?: string
  wlan0?: { ip_address: string }
}

interface WifiNetwork {
  ssid: string
  signal_strength: number
  encrypted: boolean
  bssid?: string
}

export function WiFiConfiguration() {
  const [isOpen, setIsOpen] = useState(false)
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([])
  const [scanLoading, setScanLoading] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState('')
  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/system/network`)
      if (response.ok) {
        const data = await response.json()
        setNetworkInfo(data)
      }
    } catch (error) {
      console.error('Error fetching network info:', error)
    }
  }, [])

  const scanWifiNetworks = useCallback(async () => {
    try {
      setScanLoading(true)
      const response = await fetch(`${config.apiBaseUrl}/system/scan_wifi`, {
        signal: AbortSignal.timeout(30000)
      })

      if (response.ok) {
        const data = await response.json()
        const networks = data.networks || []

        // Convert signal (dBm) to percentage if needed
        const networksWithPercent = networks.map((network: any) => {
          // Backend returns 'signal' in dBm (e.g., -70) OR 'signal_strength' as percent
          let signal_strength = network.signal_strength

          // If signal_strength is not present or looks like dBm (negative), convert it
          if (signal_strength === undefined || signal_strength < 0) {
            // signal is in dBm (e.g., -30 to -90)
            // Convert to percentage: -30 dBm = 100%, -90 dBm = 0%
            const dBm = network.signal || -90
            signal_strength = Math.max(0, Math.min(100, ((dBm + 90) / 60) * 100))
          }

          return {
            ssid: network.ssid,
            signal_strength: Math.round(signal_strength),
            encrypted: network.encrypted || false,
            bssid: network.bssid
          }
        })

        // Deduplicate networks (take strongest signal)
        const uniqueNetworks = networksWithPercent.reduce((acc: WifiNetwork[], current: WifiNetwork) => {
          const existing = acc.find(item => item.ssid === current.ssid)
          if (!existing) {
            acc.push(current)
          } else if (current.signal_strength > existing.signal_strength) {
            const index = acc.indexOf(existing)
            acc[index] = current
          }
          return acc
        }, [])

        // Sort by signal strength (strongest first)
        uniqueNetworks.sort((a: WifiNetwork, b: WifiNetwork) => b.signal_strength - a.signal_strength)

        setWifiNetworks(uniqueNetworks)

        // Only show toast if component is open
        if (isOpen) {
          toast.success(`${uniqueNetworks.length} WLAN-Netzwerke gefunden`)
        }
      } else {
        if (isOpen) {
          toast.error('Fehler beim Scannen nach WLAN-Netzwerken')
        }
      }
    } catch (error) {
      console.error('WiFi Scan Error:', error)
      if (isOpen) {
        toast.error('Fehler beim Scannen nach WLAN-Netzwerken')
      }
    } finally {
      setScanLoading(false)
    }
  }, [isOpen])

  const connectToWifi = useCallback(async () => {
    if (!selectedNetwork) {
      toast.error('Bitte wählen Sie ein WLAN-Netzwerk aus')
      return
    }

    try {
      setConnecting(true)
      const response = await fetch(`${config.apiBaseUrl}/system/connect_wifi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: selectedNetwork,
          password: password
        }),
        signal: AbortSignal.timeout(60000)
      })

      const data = await response.json()

      if (response.ok && data.success !== false) {
        toast.success(`Erfolgreich mit ${selectedNetwork} verbunden`)
        setSelectedNetwork('')
        setPassword('')
        setTimeout(() => fetchNetworkInfo(), 3000)
      } else {
        toast.error(data.message || 'Verbindung fehlgeschlagen')
      }
    } catch (error) {
      console.error('WiFi Connect Error:', error)
      toast.error('Fehler beim Verbinden mit dem WLAN')
    } finally {
      setConnecting(false)
    }
  }, [selectedNetwork, password, fetchNetworkInfo])

  const getSignalIcon = (strength: number) => {
    const bars = Math.ceil(strength / 25)
    return (
      <div className="relative w-5 h-5">
        <Signal className="w-5 h-5 text-primary" />
        <div className="absolute inset-0 flex items-end justify-center pb-0.5">
          <div className="flex gap-0.5 items-end">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className={`w-0.5 transition-all ${
                  bar <= bars ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                style={{ height: `${bar * 25}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const getSignalStrength = (strength: number): string => {
    if (strength >= 80) return 'Ausgezeichnet'
    if (strength >= 60) return 'Gut'
    if (strength >= 40) return 'Mittel'
    if (strength >= 20) return 'Schwach'
    return 'Sehr schwach'
  }

  useEffect(() => {
    fetchNetworkInfo()
    // Don't auto-scan on mount to avoid unwanted toast notifications
  }, [fetchNetworkInfo])

  const isConnected = networkInfo?.wifi_ssid && networkInfo?.wlan0?.ip_address

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-background/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Wifi className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">WiFi-Verbindung</h2>
            {isConnected && (
              <p className="text-sm text-primary">{networkInfo?.wifi_ssid}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isConnected
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {isConnected ? 'Verbunden' : 'Getrennt'}
          </span>
          <div
            onClick={(e) => {
              e.stopPropagation()
              fetchNetworkInfo()
            }}
            className="p-2 hover:bg-background/50 rounded-lg transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                fetchNetworkInfo()
              }
            }}
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4">
              {/* Connection Info */}
              {isConnected && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Verbunden mit</p>
                  <p className="text-lg font-semibold text-primary mb-3">
                    {networkInfo?.wifi_ssid}
                  </p>
                  <p className="text-sm text-muted-foreground mb-1">IP-Adresse</p>
                  <p className="font-semibold">{networkInfo?.wlan0?.ip_address}</p>
                </div>
              )}

              <div className="border-t border-border/50" />

              {/* Scan Button */}
              <button
                onClick={scanWifiNetworks}
                disabled={scanLoading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
              >
                {scanLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Scanne...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Nach WLAN-Netzwerken scannen
                  </>
                )}
              </button>

              {/* Network List */}
              {wifiNetworks.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {wifiNetworks.slice(0, 10).map((network, index) => {
                    const isSelected = selectedNetwork === network.ssid
                    const isCurrentNetwork = networkInfo?.wifi_ssid === network.ssid

                    return (
                      <motion.button
                        key={`${network.ssid}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setSelectedNetwork(network.ssid)}
                        className={`w-full p-4 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border/50 bg-background/30 hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getSignalIcon(network.signal_strength)}
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{network.ssid}</span>
                                {network.encrypted ? (
                                  <Lock className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <LockOpen className="w-4 h-4 text-green-400" />
                                )}
                                {isCurrentNetwork && (
                                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                                    Aktiv
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {getSignalStrength(network.signal_strength)} ({network.signal_strength}%)
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* Connection Form */}
              {selectedNetwork && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-4"
                >
                  <h3 className="font-semibold">
                    Verbinden mit: <span className="text-primary">{selectedNetwork}</span>
                  </h3>
                  <input
                    type="password"
                    placeholder="WLAN-Passwort"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !connecting) connectToWifi()
                    }}
                    disabled={connecting}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedNetwork('')
                        setPassword('')
                      }}
                      className="flex-1 px-4 py-2 bg-background hover:bg-background/80 border border-border rounded-lg transition-all"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={connectToWifi}
                      disabled={connecting}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50"
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verbinde...
                        </>
                      ) : (
                        <>
                          <Wifi className="w-4 h-4" />
                          Verbinden
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

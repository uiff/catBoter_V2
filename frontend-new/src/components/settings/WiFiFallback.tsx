import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, WifiOff, AlertCircle, Save, RefreshCw, Power, PowerOff, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

interface WiFiFallbackStatus {
  enabled: boolean
  ap_active: boolean
  wifi_connected: boolean
  ap_ssid: string
  ap_ip: string
  failed_checks: number
  max_failed_checks: number
}

interface WiFiFallbackConfig {
  enabled: boolean
  ssid: string
  password: string
  channel: number
  check_interval: number
  ip_address: string
  netmask: string
  dhcp_range_start: string
  dhcp_range_end: string
}

export function WiFiFallback() {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<WiFiFallbackStatus | null>(null)
  const [fallbackConfig, setFallbackConfig] = useState<WiFiFallbackConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Lokale State für Formular
  const [editEnabled, setEditEnabled] = useState(false)
  const [editSsid, setEditSsid] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editChannel, setEditChannel] = useState(6)
  const [editCheckInterval, setEditCheckInterval] = useState(30)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${config.apiBaseUrl}/system/wifi_fallback/status`)
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Error fetching WiFi fallback status:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/system/wifi_fallback/config`)
      if (res.ok) {
        const data = await res.json()
        setFallbackConfig(data)
        setEditEnabled(data.enabled)
        setEditSsid(data.ssid)
        setEditPassword('')  // Passwort nicht anzeigen
        setEditChannel(data.channel)
        setEditCheckInterval(data.check_interval)
      }
    } catch (error) {
      console.error('Error fetching WiFi fallback config:', error)
    }
  }

  const saveConfig = async () => {
    try {
      setSaving(true)

      const payload: any = {
        enabled: editEnabled,
        ssid: editSsid,
        channel: editChannel,
        check_interval: editCheckInterval
      }

      // Nur Passwort senden wenn geändert
      if (editPassword && editPassword !== '********') {
        payload.password = editPassword
      }

      const res = await fetch(`${config.apiBaseUrl}/system/wifi_fallback/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        toast.success('WiFi Fallback Konfiguration gespeichert')
        fetchConfig()
        fetchStatus()
      } else {
        toast.error('Fehler beim Speichern')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Verbindungsfehler')
    } finally {
      setSaving(false)
    }
  }

  const enableAP = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${config.apiBaseUrl}/system/wifi_fallback/enable_ap`, {
        method: 'POST'
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success(`Access Point aktiviert: ${data.ssid}`, {
          description: `IP: ${data.ip} | Passwort: ${data.password}`,
          duration: 10000
        })
        fetchStatus()
      } else {
        toast.error(data.error || 'Fehler beim Aktivieren')
      }
    } catch (error) {
      console.error('Error enabling AP:', error)
      toast.error('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  const disableAP = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${config.apiBaseUrl}/system/wifi_fallback/disable_ap`, {
        method: 'POST'
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Access Point deaktiviert')
        fetchStatus()
      } else {
        toast.error(data.error || 'Fehler beim Deaktivieren')
      }
    } catch (error) {
      console.error('Error disabling AP:', error)
      toast.error('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchStatus()
      fetchConfig()

      // Auto-refresh alle 30 Sekunden
      const interval = setInterval(() => {
        fetchStatus()
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [isOpen])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            {status && status.ap_active ? (
              <WifiOff className="w-6 h-6 text-orange-500" />
            ) : (
              <Wifi className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">WiFi Fallback (Access Point)</h2>
            <p className="text-sm text-muted-foreground">
              Automatischer Hotspot bei verlorener WiFi-Verbindung
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {!status || !fallbackConfig ? (
              <div className="px-6 pb-6">
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              </div>
            ) : (
              <div className="px-6 pb-6 space-y-4">
                {/* Status Header with Refresh */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Status</h3>
                  <button
                    onClick={fetchStatus}
                    disabled={loading}
                    className="p-2 hover:bg-background/50 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* WiFi Status */}
                <div className="p-4 rounded-lg bg-background/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">WiFi-Verbindung</span>
                    {status.wifi_connected ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {status.wifi_connected ? (
                      'Verbunden mit Netzwerk'
                    ) : (
                      <>
                        Keine Verbindung ({status.failed_checks}/{status.max_failed_checks} fehlgeschlagene Versuche)
                      </>
                    )}
                  </p>
                </div>

                {/* Access Point Status */}
                <div className={`p-4 rounded-lg border ${
                  status.ap_active
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-background/30 border-border/50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Access Point Status</span>
                    {status.ap_active ? (
                      <Power className="w-5 h-5 text-orange-500" />
                    ) : (
                      <PowerOff className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {status.ap_active ? (
                      <>
                        <span className="text-orange-500 font-semibold">Aktiv:</span> {status.ap_ssid} | IP: {status.ap_ip}
                      </>
                    ) : (
                      'Inaktiv'
                    )}
                  </p>

                  {/* Manuelle Steuerung */}
                  <div className="flex gap-2 mt-4">
                    {status.ap_active ? (
                      <button
                        onClick={disableAP}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50"
                      >
                        <PowerOff className="w-4 h-4" />
                        AP Deaktivieren
                      </button>
                    ) : (
                      <button
                        onClick={enableAP}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50"
                      >
                        <Power className="w-4 h-4" />
                        AP Manuell Aktivieren
                      </button>
                    )}
                  </div>
                </div>

                {/* Info Banner */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-500 mb-1">So funktioniert WiFi Fallback:</p>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>System überwacht WiFi-Verbindung alle {fallbackConfig.check_interval}s</li>
                        <li>Nach {status.max_failed_checks} fehlgeschlagenen Versuchen → Access Point wird aktiviert</li>
                        <li>Verbinden Sie sich mit "{status.ap_ssid}" um CatBoter zu konfigurieren</li>
                        <li>Access Point wird automatisch deaktiviert wenn WiFi wiederhergestellt</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Konfiguration */}
                <div className="border-t border-border/50 pt-4">
                  <h3 className="font-semibold mb-4">Konfiguration</h3>

                  <div className="space-y-4">
                    {/* Enabled Toggle */}
                    <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
                      <div>
                        <h4 className="font-medium">WiFi Fallback aktivieren</h4>
                        <p className="text-sm text-muted-foreground">
                          Automatischer Access Point bei Verbindungsverlust
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEnabled}
                          onChange={(e) => setEditEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {/* SSID */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Access Point Name (SSID)</label>
                      <input
                        type="text"
                        value={editSsid}
                        onChange={(e) => setEditSsid(e.target.value)}
                        placeholder="CatBoter-Setup"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Passwort */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Access Point Passwort</label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Neues Passwort (leer lassen für unverändert)"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Mindestens 8 Zeichen
                      </p>
                    </div>

                    {/* Channel */}
                    <div>
                      <label className="block text-sm font-medium mb-2">WiFi Kanal</label>
                      <select
                        value={editChannel}
                        onChange={(e) => setEditChannel(Number(e.target.value))}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(ch => (
                          <option key={ch} value={ch}>Kanal {ch}</option>
                        ))}
                      </select>
                    </div>

                    {/* Check Interval */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Prüf-Intervall (Sekunden)</label>
                      <input
                        type="number"
                        value={editCheckInterval}
                        onChange={(e) => setEditCheckInterval(Number(e.target.value))}
                        min="10"
                        max="300"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={saveConfig}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Wird gespeichert...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Einstellungen speichern
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

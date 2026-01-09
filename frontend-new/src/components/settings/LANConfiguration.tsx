import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Network, RefreshCw, Save, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

interface NetworkInterfaces {
  eth0?: {
    ip_address: string
    netmask?: string
    gateway?: string
    dns?: string
    use_dhcp?: boolean
  }
}

export function LANConfiguration() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [useDHCP, setUseDHCP] = useState(true)
  const [ip, setIp] = useState('')
  const [netmask, setNetmask] = useState('')
  const [gateway, setGateway] = useState('')
  const [dns, setDns] = useState('')
  const [interfaces, setInterfaces] = useState<NetworkInterfaces>({})

  const fetchNetworkInfo = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`${config.apiBaseUrl}/system/network`)
      if (response.ok) {
        const data = await response.json()
        setInterfaces(data || {})
        setUseDHCP(data.eth0?.use_dhcp !== false)
        if (!data.eth0?.use_dhcp) {
          setIp(data.eth0?.ip_address || '')
          setNetmask(data.eth0?.netmask || '')
          setGateway(data.eth0?.gateway || '')
          setDns(data.eth0?.dns || '')
        }
      }
    } catch (error) {
      console.error('Error fetching network info:', error)
      toast.error('Fehler beim Abrufen der Netzwerkinformationen')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSaveLANConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${config.apiBaseUrl}/system/configure_lan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          use_dhcp: useDHCP,
          ip: useDHCP ? '' : ip,
          netmask: useDHCP ? '' : netmask,
          gateway: useDHCP ? '' : gateway,
          dns: useDHCP ? '' : dns
        })
      })

      if (response.ok) {
        toast.success('LAN-Konfiguration erfolgreich gespeichert')
        setTimeout(() => fetchNetworkInfo(), 2000)
      } else {
        toast.error('Fehler beim Speichern der LAN-Konfiguration')
      }
    } catch (error) {
      console.error('Error saving LAN config:', error)
      toast.error('Fehler beim Speichern der LAN-Konfiguration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNetworkInfo()
  }, [fetchNetworkInfo])

  const isConnected = interfaces.eth0 && interfaces.eth0.ip_address
  const connectionType = useDHCP ? 'DHCP' : 'Statisch'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-background/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">Ethernet-Verbindung</h2>
            {isConnected && (
              <p className="text-sm text-primary">{interfaces.eth0?.ip_address}</p>
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
              if (!loading) fetchNetworkInfo()
            }}
            className={`p-2 hover:bg-background/50 rounded-lg transition-colors cursor-pointer ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !loading) {
                e.stopPropagation()
                fetchNetworkInfo()
              }
            }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            )}
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
                  <p className="text-sm text-muted-foreground mb-1">IP-Adresse</p>
                  <p className="text-lg font-semibold text-primary mb-3">
                    {interfaces.eth0?.ip_address}
                  </p>
                  <p className="text-sm text-muted-foreground mb-1">Verbindungstyp</p>
                  <p className="font-semibold text-primary">{connectionType}</p>
                </div>
              )}

              <div className="border-t border-border/50" />

              {/* DHCP Toggle */}
              <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
                <div>
                  <h3 className="font-medium">DHCP verwenden</h3>
                  <p className="text-sm text-muted-foreground">
                    IP-Adresse wird automatisch zugewiesen
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDHCP}
                    onChange={(e) => {
                      setUseDHCP(e.target.checked)
                      if (e.target.checked) {
                        setIp('')
                        setNetmask('')
                        setGateway('')
                        setDns('')
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Manual Configuration */}
              {!useDHCP && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-4"
                >
                  <h3 className="font-semibold flex items-center gap-2">
                    <Network className="w-5 h-5" />
                    Manuelle Konfiguration
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        IP-Adresse
                      </label>
                      <input
                        type="text"
                        value={ip}
                        onChange={(e) => setIp(e.target.value)}
                        placeholder="192.168.1.100"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Netzmaske
                      </label>
                      <input
                        type="text"
                        value={netmask}
                        onChange={(e) => setNetmask(e.target.value)}
                        placeholder="255.255.255.0"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Gateway
                      </label>
                      <input
                        type="text"
                        value={gateway}
                        onChange={(e) => setGateway(e.target.value)}
                        placeholder="192.168.1.1"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        DNS-Server
                      </label>
                      <input
                        type="text"
                        value={dns}
                        onChange={(e) => setDns(e.target.value)}
                        placeholder="8.8.8.8"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSaveLANConfig}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

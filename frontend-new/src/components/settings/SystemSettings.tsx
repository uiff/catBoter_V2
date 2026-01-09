import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Save, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

export function SystemSettings() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [lowTankThreshold, setLowTankThreshold] = useState(20)

  const handleSaveSettings = () => {
    setLoading(true)

    // Save to localStorage
    localStorage.setItem('settings', JSON.stringify({
      autoRefresh,
      notifications,
      lowTankThreshold
    }))

    setTimeout(() => {
      setLoading(false)
      toast.success('Einstellungen gespeichert', {
        description: 'Änderungen wurden übernommen'
      })
    }, 500)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">Systemeinstellungen</h2>
            <p className="text-sm text-muted-foreground">App-Einstellungen konfigurieren</p>
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
            <div className="px-6 pb-6">
              <div className="space-y-4">
                {/* Auto Refresh */}
                <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
                  <div>
                    <h3 className="font-medium">Automatische Aktualisierung</h3>
                    <p className="text-sm text-muted-foreground">
                      Sensordaten automatisch alle 10 Sekunden aktualisieren
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg">
                  <div>
                    <h3 className="font-medium">Benachrichtigungen</h3>
                    <p className="text-sm text-muted-foreground">
                      Toast-Benachrichtigungen für Aktionen anzeigen
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications}
                      onChange={(e) => setNotifications(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Low Tank Threshold */}
                <div className="p-4 bg-background/30 rounded-lg">
                  <h3 className="font-medium mb-2">Tankfüllstand-Warnung</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Warnung anzeigen wenn Füllstand unter {lowTankThreshold}% fällt
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={lowTankThreshold}
                      onChange={(e) => setLowTankThreshold(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-lg font-semibold min-w-[4rem] text-right">
                      {lowTankThreshold}%
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Speichern...' : 'Einstellungen speichern'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

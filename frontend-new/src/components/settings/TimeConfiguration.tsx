import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Wifi, Edit, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

interface TimeStatus {
  current_time: string
  ntp_enabled: boolean
  ntp_synced: boolean
}

export function TimeConfiguration() {
  const [isOpen, setIsOpen] = useState(false)
  const [timeMode, setTimeMode] = useState<'ntp' | 'manual'>('ntp')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [manualDate, setManualDate] = useState('')
  const [manualTime, setManualTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [ntpStatus, setNtpStatus] = useState<'synced' | 'not_synced' | 'unknown'>('unknown')

  useEffect(() => {
    loadTimeStatus()
    const interval = setInterval(loadTimeStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadTimeStatus = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/system/time_status`)
      if (response.ok) {
        const data: TimeStatus = await response.json()
        setCurrentTime(data.current_time || '')
        setTimeMode(data.ntp_enabled ? 'ntp' : 'manual')
        setNtpStatus(data.ntp_synced ? 'synced' : 'not_synced')
      }
    } catch (error) {
      console.error('Failed to load time status:', error)
    }
  }

  const handleSaveTime = async () => {
    setLoading(true)

    try {
      if (timeMode === 'ntp') {
        const response = await fetch(`${config.apiBaseUrl}/system/enable_ntp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })

        if (response.ok) {
          toast.success('NTP-Zeitsynchronisation aktiviert!')
          loadTimeStatus()
        } else {
          const errorData = await response.json()
          toast.error('Fehler', {
            description: errorData.error || 'Fehler beim Aktivieren von NTP'
          })
        }
      } else {
        if (!manualDate || !manualTime) {
          toast.error('Ungültige Eingabe', {
            description: 'Bitte Datum und Uhrzeit eingeben'
          })
          return
        }

        const response = await fetch(`${config.apiBaseUrl}/system/set_time`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: manualDate,
            time: manualTime
          })
        })

        if (response.ok) {
          toast.success('Zeit erfolgreich gesetzt!')
          loadTimeStatus()
        } else {
          const errorData = await response.json()
          toast.error('Fehler', {
            description: errorData.error || 'Fehler beim Setzen der Zeit'
          })
        }
      }
    } catch (error) {
      console.error('Time configuration error:', error)
      toast.error('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncNow = async () => {
    setLoading(true)

    try {
      const response = await fetch(`${config.apiBaseUrl}/system/sync_ntp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        toast.success('Zeit erfolgreich synchronisiert!')
        loadTimeStatus()
      } else {
        const errorData = await response.json()
        toast.error('Fehler', {
          description: errorData.error || 'Fehler bei der Synchronisation'
        })
      }
    } catch (error) {
      console.error('NTP sync error:', error)
      toast.error('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">Zeitkonfiguration</h2>
            <p className="text-sm text-muted-foreground">{currentTime || 'Lädt...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ntpStatus === 'synced' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
              NTP Aktiv
            </span>
          )}
          {ntpStatus === 'not_synced' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">
              Manuell
            </span>
          )}
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
              {/* Current Time Display */}
              <div className="mb-6 p-4 bg-background/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Aktuelle Zeit</p>
                    <p className="text-2xl font-mono font-semibold">{currentTime || 'Lädt...'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {ntpStatus === 'synced' && (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
                        <Wifi className="w-3 h-3" />
                        NTP Synchronisiert
                      </span>
                    )}
                    {ntpStatus === 'not_synced' && (
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                        Nicht synchronisiert
                      </span>
                    )}
                  </div>
                </div>
              </div>

      {/* Time Mode Selection */}
      <div className="space-y-4 mb-6">
        <label className="flex items-center gap-3 p-4 bg-background/30 rounded-lg cursor-pointer hover:bg-background/50 transition-all">
          <input
            type="radio"
            name="timeMode"
            checked={timeMode === 'ntp'}
            onChange={() => setTimeMode('ntp')}
            className="w-4 h-4 text-primary"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-primary" />
              <h3 className="font-medium">NTP-Zeitsynchronisation (empfohlen)</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Automatische Zeitsynchronisation über Internet
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-4 bg-background/30 rounded-lg cursor-pointer hover:bg-background/50 transition-all">
          <input
            type="radio"
            name="timeMode"
            checked={timeMode === 'manual'}
            onChange={() => setTimeMode('manual')}
            className="w-4 h-4 text-primary"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Edit className="w-4 h-4 text-primary" />
              <h3 className="font-medium">Manuelle Zeiteinstellung</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Zeit manuell festlegen
            </p>
          </div>
        </label>
      </div>

      {/* Manual Time Settings */}
      {timeMode === 'manual' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3 mb-6"
        >
          <div>
            <label className="block text-sm font-medium mb-2">Datum</label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Uhrzeit</label>
            <input
              type="time"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              step="1"
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSaveTime}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Speichern...' : 'Speichern'}
        </button>

        {timeMode === 'ntp' && (
          <button
            onClick={handleSyncNow}
            disabled={loading}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50"
            title="Jetzt synchronisieren"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </div>

              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-200">
                  <strong>Hinweis:</strong> NTP-Synchronisation erfordert eine aktive Internetverbindung.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

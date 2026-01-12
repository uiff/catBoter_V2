import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Container, Save, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

interface CalibrationData {
  min_distance: number  // Voller Tank (kurze Distanz) - FEST auf 3cm
  max_distance: number  // Leerer Tank (lange Distanz) - Kalibrierbar
}

export function TankCalibration() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentDistance, setCurrentDistance] = useState<number | null>(null)
  const [calibration, setCalibration] = useState<CalibrationData>({ min_distance: 3, max_distance: 23 })
  const [manualMaxDistance, setManualMaxDistance] = useState<string>('23')
  const [loading, setLoading] = useState(false)

  const fetchCurrentDistance = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/distance`)
      if (res.ok) {
        const data = await res.json()
        setCurrentDistance(data.distance)
      }
    } catch (error) {
      console.error('Error fetching distance:', error)
    }
  }

  const fetchCalibration = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/tank/calibration`)
      if (res.ok) {
        const data = await res.json()
        setCalibration(data)
        setManualMaxDistance(data.max_distance.toString())
      }
    } catch (error) {
      console.error('Error fetching calibration:', error)
    }
  }

  const saveCalibration = async (maxDistance: number) => {
    try {
      setLoading(true)

      // min_distance ist immer fest auf 3cm
      const data = {
        min_distance: 3,
        max_distance: maxDistance
      }

      const res = await fetch(`${config.apiBaseUrl}/tank/calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        toast.success('Kalibrierung gespeichert')
        setCalibration(data)
        setManualMaxDistance(maxDistance.toString())
      } else {
        toast.error('Fehler beim Speichern')
      }
    } catch (error) {
      console.error('Error saving calibration:', error)
      toast.error('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  const calibrateMeasured = async () => {
    if (currentDistance === null) {
      toast.error('Keine Distanzmessung verfügbar')
      return
    }

    if (currentDistance <= 3) {
      toast.error('Distanz muss größer als 3cm sein (Tank voll = 3cm)')
      return
    }

    await saveCalibration(currentDistance)
  }

  const calibrateManual = async () => {
    const value = parseFloat(manualMaxDistance)

    if (isNaN(value) || value <= 3 || value > 100) {
      toast.error('Bitte gültigen Wert eingeben (größer als 3cm, max 100cm)')
      return
    }

    await saveCalibration(value)
  }

  useEffect(() => {
    if (isOpen) {
      fetchCurrentDistance()
      fetchCalibration()

      // Refresh current distance every 2 seconds
      const interval = setInterval(fetchCurrentDistance, 2000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  const getTankPercent = () => {
    if (currentDistance === null) return 0
    const range = calibration.max_distance - calibration.min_distance
    if (range === 0) return 0
    const percent = 100 - ((currentDistance - calibration.min_distance) / range) * 100
    return Math.max(0, Math.min(100, percent))
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
            <Container className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">Tankfüllstand Kalibrierung</h2>
            <p className="text-sm text-muted-foreground">
              Kalibriere den leeren Tank (Tank voll ist fest auf 3cm)
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
            <div className="px-6 pb-6 space-y-6">
              {/* Current Measurement */}
              <div className="p-4 bg-background/30 rounded-lg border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Aktuelle Messung</span>
                  {currentDistance !== null && (
                    <span className="text-2xl font-bold text-primary">
                      {Math.round(getTankPercent())}%
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Distanz:</span>
                  <span className="font-medium">
                    {currentDistance !== null ? `${currentDistance.toFixed(1)} cm` : '---'}
                  </span>
                </div>
              </div>

              {/* Info: Tank Voll ist fest */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h4 className="font-medium text-blue-400 mb-2">Tank Voll (fest konfiguriert)</h4>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Minimale Distanz bei vollem Tank
                  </p>
                  <span className="text-lg font-bold text-blue-400">3 cm</span>
                </div>
              </div>

              {/* Calibration: Tank Leer */}
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-4">
                <div>
                  <h4 className="font-medium text-red-400 mb-1">Tank Leer Kalibrierung</h4>
                  <p className="text-xs text-muted-foreground">
                    Leeren Sie den Tank komplett und kalibrieren Sie
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Aktuell gespeichert:</span>
                  <span className="font-medium">{calibration.max_distance.toFixed(1)} cm</span>
                </div>

                {/* Option 1: Messen */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Option 1: Automatisch messen</label>
                  <button
                    onClick={calibrateMeasured}
                    disabled={loading || currentDistance === null}
                    className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Speichere...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Aktuelle Distanz übernehmen ({currentDistance?.toFixed(1) ?? '---'} cm)
                      </>
                    )}
                  </button>
                </div>

                {/* Option 2: Manuell */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Option 2: Manuell eingeben</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={manualMaxDistance}
                      onChange={(e) => setManualMaxDistance(e.target.value)}
                      placeholder="z.B. 23"
                      min="4"
                      max="100"
                      step="0.1"
                      className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={calibrateManual}
                      disabled={loading}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Speichern
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Wert in cm (muss größer als 3 sein)
                  </p>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-400">
                  <strong>Hinweis:</strong> Tank voll ist immer 3cm. Sie müssen nur den Tank-Leer-Wert kalibrieren.
                  Dies können Sie entweder automatisch messen oder manuell eingeben.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

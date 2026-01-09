import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scale, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

export function WeightCalibration() {
  const [isOpen, setIsOpen] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [calibrationWeight, setCalibrationWeight] = useState(100)

  const handleTare = async () => {
    setCalibrating(true)
    try {
      const response = await fetch(`${config.apiBaseUrl}/calibrate_weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tare' })
      })

      if (response.ok) {
        toast.success('Gewichtssensor tariert', {
          description: 'Nullpunkt wurde gesetzt'
        })
      } else {
        toast.error('Tarierung fehlgeschlagen')
      }
    } catch (error) {
      toast.error('Verbindungsfehler')
    } finally {
      setCalibrating(false)
    }
  }

  const handleCalibrate = async () => {
    if (calibrationWeight <= 0) {
      toast.error('Ungültiges Kalibriergewicht', {
        description: 'Gewicht muss größer als 0g sein'
      })
      return
    }

    setCalibrating(true)
    try {
      const response = await fetch(`${config.apiBaseUrl}/calibrate_weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calibrate',
          weight: calibrationWeight
        })
      })

      if (response.ok) {
        toast.success('Kalibrierung erfolgreich', {
          description: `Sensor mit ${calibrationWeight}g kalibriert`
        })
      } else {
        toast.error('Kalibrierung fehlgeschlagen')
      }
    } catch (error) {
      toast.error('Verbindungsfehler')
    } finally {
      setCalibrating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Scale className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">Gewichtssensor-Kalibrierung</h2>
            <p className="text-sm text-muted-foreground">Sensor tarieren und kalibrieren</p>
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
                {/* Tare */}
                <div className="p-4 bg-background/30 rounded-lg">
                  <h3 className="font-medium mb-2">Tarieren (Nullpunkt setzen)</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Entferne alle Gewichte vom Sensor und setze den Nullpunkt
                  </p>
                  <button
                    onClick={handleTare}
                    disabled={calibrating}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50"
                  >
                    {calibrating ? 'Tariere...' : 'Tarieren'}
                  </button>
                </div>

                {/* Calibrate */}
                <div className="p-4 bg-background/30 rounded-lg">
                  <h3 className="font-medium mb-2">Kalibrieren</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Lege ein bekanntes Gewicht auf den Sensor
                  </p>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={calibrationWeight}
                      onChange={(e) => setCalibrationWeight(Number(e.target.value))}
                      placeholder="Gewicht in Gramm"
                      className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="flex items-center px-4 text-muted-foreground">g</span>
                  </div>
                  <button
                    onClick={handleCalibrate}
                    disabled={calibrating}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50"
                  >
                    {calibrating ? 'Kalibriere...' : 'Kalibrieren'}
                  </button>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-200">
                    <strong>Hinweis:</strong> Für beste Ergebnisse zuerst tarieren, dann mit einem bekannten Gewicht kalibrieren.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'

export function SystemNotifications() {
  const { sensorData } = useWebSocket()
  const [alerts, setAlerts] = useState<Array<{ type: 'warning' | 'error' | 'info'; message: string }>>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const newAlerts: Array<{ type: 'warning' | 'error' | 'info'; message: string }> = []

    // Check tank level
    if (sensorData.distance !== null) {
      if (sensorData.distance < 10) {
        newAlerts.push({
          type: 'error',
          message: `⚠️ Futtertank kritisch niedrig (${sensorData.distance.toFixed(0)}%) - Sofort auffüllen!`
        })
      } else if (sensorData.distance < 20) {
        newAlerts.push({
          type: 'warning',
          message: `⚠️ Futtertank niedrig (${sensorData.distance.toFixed(0)}%) - Bitte bald auffüllen`
        })
      }
    }

    // Check motor status
    if (sensorData.motor === 1) {
      newAlerts.push({
        type: 'info',
        message: '🔄 Motor läuft gerade'
      })
    }

    setAlerts(newAlerts)
  }, [sensorData])

  const getIcon = (type: 'warning' | 'error' | 'info') => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getColors = (type: 'warning' | 'error' | 'info') => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          text: 'text-red-200'
        }
      case 'warning':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          text: 'text-amber-200'
        }
      case 'info':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          text: 'text-blue-200'
        }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-background/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">System-Benachrichtigungen</h2>
            {alerts.length > 0 && (
              <p className="text-sm text-muted-foreground">{alerts.length} aktive Meldung(en)</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {alerts.length} Warnung(en)
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
              Alles OK
            </span>
          )}
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
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((alert, index) => {
                    const colors = getColors(alert.type)
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-lg border flex items-start gap-3 ${colors.bg} ${colors.border}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(alert.type)}
                        </div>
                        <p className={`text-sm flex-1 ${colors.text}`}>
                          {alert.message}
                        </p>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-6 text-center bg-background/30 rounded-lg">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Alle Systeme funktionieren normal
                  </p>
                </div>
              )}

              <div className="p-4 bg-background/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">WebSocket-Status:</span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="text-green-400 font-medium">Verbunden</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Letztes Update:</span>
                  <span className="font-mono text-xs">{new Date(sensorData.timestamp * 1000).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Power, RotateCcw, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

type SystemAction = 'restart_backend' | 'reboot' | 'shutdown'

interface ConfirmDialog {
  open: boolean
  action: SystemAction
  title: string
  description: string
}

export function SystemControl() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)

  const handleAction = async (action: SystemAction) => {
    setLoading(true)
    setConfirmDialog(null)

    try {
      let endpoint = ''
      let successMsg = ''

      switch (action) {
        case 'restart_backend':
          endpoint = `${config.apiBaseUrl}/system/restart_backend`
          successMsg = 'Backend wird neu gestartet...'
          break
        case 'reboot':
          endpoint = `${config.apiBaseUrl}/system/reboot`
          successMsg = 'System wird neu gestartet...'
          break
        case 'shutdown':
          endpoint = `${config.apiBaseUrl}/system/shutdown`
          successMsg = 'System wird heruntergefahren...'
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || successMsg, {
          duration: 5000
        })

        if (action === 'restart_backend') {
          setTimeout(() => {
            window.location.reload()
          }, 15000)
        }

        if (action === 'reboot') {
          toast.info('System startet neu... Die Seite wird automatisch neu geladen.', {
            duration: 60000
          })
          setTimeout(() => {
            window.location.reload()
          }, 60000)
        }

        if (action === 'shutdown') {
          toast.warning('System wird heruntergefahren. Verbindung wird getrennt.', {
            duration: 10000
          })
        }
      } else {
        const errorData = await response.json()
        toast.error('Fehler', {
          description: errorData.error || 'Aktion fehlgeschlagen'
        })
      }
    } catch (error) {
      toast.error('Verbindungsfehler', {
        description: 'Konnte nicht mit dem Backend kommunizieren'
      })
      console.error('System control error:', error)
    } finally {
      setLoading(false)
    }
  }

  const openConfirmDialog = (action: SystemAction) => {
    const dialogs: Record<SystemAction, { title: string; description: string }> = {
      restart_backend: {
        title: 'Backend neu starten?',
        description: 'Das Backend wird neu gestartet. Dies dauert etwa 10-30 Sekunden.'
      },
      reboot: {
        title: 'System neu starten?',
        description: 'Der CatBoter wird neu gestartet. Dies dauert etwa 1-2 Minuten. Die Verbindung wird unterbrochen.'
      },
      shutdown: {
        title: 'System herunterfahren?',
        description: 'Der CatBoter wird heruntergefahren. Sie müssen ihn manuell wieder einschalten.'
      }
    }

    setConfirmDialog({
      open: true,
      action,
      ...dialogs[action]
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-xl overflow-hidden"
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Power className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold">Systemsteuerung</h2>
            <p className="text-sm text-muted-foreground">Backend & System neustarten</p>
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
              <div className="space-y-3">
                {/* Restart Backend */}
                <button
          onClick={() => openConfirmDialog('restart_backend')}
          disabled={loading}
          className="w-full flex items-center gap-3 p-4 bg-background/30 hover:bg-background/50 rounded-lg transition-all disabled:opacity-50"
        >
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <RotateCcw className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-medium">Backend neu starten</h3>
            <p className="text-sm text-muted-foreground">Python-Backend neustarten (10-30 Sekunden)</p>
          </div>
        </button>

        {/* Reboot System */}
        <button
          onClick={() => openConfirmDialog('reboot')}
          disabled={loading}
          className="w-full flex items-center gap-3 p-4 bg-background/30 hover:bg-background/50 rounded-lg transition-all disabled:opacity-50"
        >
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Power className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-medium">System neu starten</h3>
            <p className="text-sm text-muted-foreground">CatBoter komplett neustarten (1-2 Minuten)</p>
          </div>
        </button>

        {/* Shutdown System */}
        <button
          onClick={() => openConfirmDialog('shutdown')}
          disabled={loading}
          className="w-full flex items-center gap-3 p-4 bg-background/30 hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
        >
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-medium">System herunterfahren</h3>
            <p className="text-sm text-muted-foreground">CatBoter sauber herunterfahren</p>
          </div>
        </button>
              </div>

              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-200">
                  <strong>Warnung:</strong> Diese Aktionen unterbrechen kurzzeitig die Verbindung zum System.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-xl p-6 max-w-md w-full"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{confirmDialog.title}</h3>
                <p className="text-sm text-muted-foreground">{confirmDialog.description}</p>
              </div>
              <button
                onClick={() => setConfirmDialog(null)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2 px-4 bg-background/50 hover:bg-background/70 rounded-lg font-medium transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleAction(confirmDialog.action)}
                disabled={loading}
                className="flex-1 py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {loading ? 'Wird ausgeführt...' : 'Bestätigen'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

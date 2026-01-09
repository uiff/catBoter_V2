import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone } from 'lucide-react'
import { usePWA } from '@/hooks/usePWA'

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, promptInstall } = usePWA()
  const [dismissed, setDismissed] = useState(false)

  // Don't show if already installed, not installable, or user dismissed
  if (isInstalled || !isInstallable || dismissed) {
    return null
  }

  const handleInstall = async () => {
    const accepted = await promptInstall()
    if (accepted) {
      setDismissed(true)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    // Save dismissal to localStorage (expires after 7 days)
    const dismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000
    localStorage.setItem('pwa-install-dismissed', dismissedUntil.toString())
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50"
      >
        <div className="glass rounded-xl p-4 shadow-2xl border border-primary/20">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 hover:bg-background/50 rounded-lg transition-colors"
            aria-label="Schließen"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>

            <div className="flex-1 pr-6">
              <h3 className="font-semibold text-lg mb-1">
                CatBot als App installieren
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Installiere CatBot auf deinem Startbildschirm für schnellen Zugriff und Offline-Nutzung
              </p>

              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-lg transition-all"
              >
                <Download className="w-5 h-5" />
                Jetzt installieren
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

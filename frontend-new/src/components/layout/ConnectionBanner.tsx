import { WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useConnection } from '@/stores/socketStore'

export function ConnectionBanner() {
  const connection = useConnection()

  return (
    <AnimatePresence>
      {connection === 'offline' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 bg-danger-soft px-4 py-2 text-sm text-danger">
            <WifiOff className="h-4 w-4 shrink-0" />
            Verbindung zum CatBoter unterbrochen - versuche erneut zu verbinden…
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

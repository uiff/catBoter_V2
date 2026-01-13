import { motion } from 'framer-motion'
import { Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionsProps {
  onManualFeed: () => void
  onStop: () => void
  isMotorRunning?: boolean
}

export function QuickActions({ onManualFeed, onStop, isMotorRunning }: QuickActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex gap-3">
        <button
          onClick={onManualFeed}
          disabled={isMotorRunning}
          className={cn(
            'flex-1 flex items-center justify-center gap-3',
            'rounded-lg py-5 px-6',
            'font-semibold transition-all relative overflow-hidden',
            isMotorRunning
              ? 'bg-green-600 hover:bg-green-700 text-white animate-pulse-glow cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          )}
        >
          <Play className={cn("w-5 h-5", isMotorRunning && "animate-pulse")} />
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold">
              {isMotorRunning ? '🔄 Motor läuft' : 'Manuell füttern'}
            </span>
            {isMotorRunning && (
              <span className="text-xs opacity-90">Fütterung aktiv...</span>
            )}
            {!isMotorRunning && (
              <span className="text-xs opacity-70">Motor bereit</span>
            )}
          </div>
        </button>

        <button
          onClick={onStop}
          className={cn(
            "rounded-lg px-6 py-5 transition-all font-semibold",
            isMotorRunning
              ? "bg-red-600 hover:bg-red-700 text-white border-2 border-red-400 shadow-lg shadow-red-500/50"
              : "glass glass-hover text-muted-foreground hover:bg-muted/10"
          )}
          title="Motor stoppen (Notfall-Stop)"
        >
          <Square className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  )
}

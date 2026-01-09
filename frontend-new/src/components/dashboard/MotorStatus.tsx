import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MotorStatusProps {
  isRunning: boolean
}

export function MotorStatus({ isRunning }: MotorStatusProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-lg transition-all',
          isRunning ? 'bg-green-500/20 animate-pulse-glow' : 'bg-muted'
        )}>
          <Zap className={cn(
            'w-5 h-5',
            isRunning ? 'text-green-500' : 'text-muted-foreground'
          )} />
        </div>
        <div>
          <p className="text-sm font-medium">Motor Status</p>
          <p className={cn(
            'text-xs',
            isRunning ? 'text-green-500' : 'text-muted-foreground'
          )}>
            {isRunning ? 'Läuft' : 'Bereit'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

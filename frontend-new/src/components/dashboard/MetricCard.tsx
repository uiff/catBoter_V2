import { motion } from 'framer-motion'
import { type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type FC } from 'react'

interface MetricCardProps {
  icon: FC<LucideProps>
  label: string
  value: string
  status?: 'good' | 'warning' | 'danger'
  trend?: { value: number; isPositive: boolean }
}

export function MetricCard({ icon: Icon, label, value, status = 'good', trend }: MetricCardProps) {
  const statusColors = {
    good: 'from-green-500/20 to-green-600/20 border-green-500/30',
    warning: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
    danger: 'from-red-500/20 to-red-600/20 border-red-500/30',
  }

  const iconColors = {
    good: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass glass-hover rounded-xl p-6 relative overflow-hidden',
        'bg-gradient-to-br border-2',
        statusColors[status]
      )}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('p-2.5 rounded-lg bg-background/50 backdrop-blur-sm', iconColors[status])}>
            <Icon className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {trend && (
          <p className={cn(
            'text-xs mt-2',
            trend.isPositive ? 'text-green-500' : 'text-red-500'
          )}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </p>
        )}
      </div>
    </motion.div>
  )
}

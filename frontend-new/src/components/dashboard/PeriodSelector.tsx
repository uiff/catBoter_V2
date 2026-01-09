import { cn } from '@/lib/utils'

type Period = 'week' | 'month'

interface PeriodSelectorProps {
  selected: Period
  onChange: (period: Period) => void
}

export function PeriodSelector({ selected, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex p-1 bg-background/30 rounded-lg border border-border/50">
      <button
        onClick={() => onChange('week')}
        className={cn(
          'px-4 py-2 rounded-md text-sm font-medium transition-all',
          selected === 'week'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
        )}
      >
        Woche
      </button>
      <button
        onClick={() => onChange('month')}
        className={cn(
          'px-4 py-2 rounded-md text-sm font-medium transition-all',
          selected === 'month'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
        )}
      >
        Monat
      </button>
    </div>
  )
}

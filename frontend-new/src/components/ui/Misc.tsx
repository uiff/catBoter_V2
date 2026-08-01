/** Kleine Bausteine: Skeleton, ProgressBar, SegmentedControl, Stepper, EmptyState, Switch. */
import type { LucideIcon } from 'lucide-react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} />
}

interface ProgressBarProps {
  value: number
  max: number
  className?: string
  colorClass?: string
}

export function ProgressBar({ value, max, className, colorClass = 'bg-primary' }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', colorClass)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string; icon?: LucideIcon }>
  value: T
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex rounded-md bg-surface-2 p-0.5', className)} role="tablist">
      {options.map((option) => {
        const Icon = option.icon
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-surface text-foreground shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  className?: string
}

export function Stepper({ value, onChange, min, max, step = 1, suffix, className }: StepperProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        aria-label="Verringern"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="tnum min-w-16 flex-1 text-center text-lg font-semibold">
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
      <button
        aria-label="Erhöhen"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-64 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        checked ? 'bg-primary' : 'bg-surface-2 ring-1 ring-inset ring-border',
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white',
          'shadow-sm ring-1 ring-black/10 transition-[left] duration-200',
          checked ? 'left-[26px]' : 'left-1',
        )}
      />
    </button>
  )
}

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface shadow-card', className)}
      {...props}
    />
  )
}

interface CardHeaderProps {
  title: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2 p-4 pb-0', className)}>
      <div className="flex items-center gap-2 font-medium">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {title}
      </div>
      {action}
    </div>
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}

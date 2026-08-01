import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Card } from './Card'
import { cn } from '@/lib/utils'

interface CollapsibleCardProps {
  title: string
  icon?: ReactNode
  /** Kompakte Zusatzinfo rechts im Header (auch zugeklappt sichtbar) */
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * Einklappbare Settings-Karte. Inhalt wird erst beim Aufklappen GEMOUNTET -
 * das hält die System-Seite übersichtlich und spart Queries (WLAN-Scan-Status,
 * Fallback-Polling etc. laufen nicht für zugeklappte Karten).
 */
export function CollapsibleCard({
  title,
  icon,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-2 px-4 py-3 text-left"
      >
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="font-medium">{title}</span>
        <span className="ml-auto flex items-center gap-2">
          {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

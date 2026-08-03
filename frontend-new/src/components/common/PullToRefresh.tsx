import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { queryClient } from '@/App'
import { cn } from '@/lib/utils'

const TRIGGER_PX = 70
const MAX_PULL_PX = 110

/**
 * Pull-to-Refresh für den <main>-Scroller der App-Shell.
 *
 * Bewusst schlicht: Ziehen ab Scroll-Position 0 zeigt den Indikator; ab der
 * Schwelle werden beim Loslassen alle Queries invalidiert (die Socket-Daten
 * sind ohnehin live - das hier ist die erwartete Geste, nicht die Notwendigkeit).
 */
export function PullToRefresh({ children, className }: { children: ReactNode; className?: string }) {
  const scroller = useRef<HTMLElement | null>(null)
  const startY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onTouchStart = (event: TouchEvent) => {
    if ((scroller.current?.scrollTop ?? 1) <= 0 && !refreshing) {
      startY.current = event.touches[0].clientY
    } else {
      startY.current = null
    }
  }

  const onTouchMove = (event: TouchEvent) => {
    if (startY.current === null || refreshing) return
    const delta = event.touches[0].clientY - startY.current
    if (delta <= 0 || (scroller.current?.scrollTop ?? 0) > 0) {
      setPull(0)
      return
    }
    // Gummiband: je weiter gezogen, desto zäher
    setPull(Math.min(MAX_PULL_PX, delta * 0.5))
  }

  const onTouchEnd = () => {
    if (startY.current === null) return
    startY.current = null
    if (pull >= TRIGGER_PX * 0.5 && !refreshing) {
      setRefreshing(true)
      queryClient.invalidateQueries()
      window.setTimeout(() => {
        setRefreshing(false)
        setPull(0)
      }, 800)
    } else {
      setPull(0)
    }
  }

  const active = refreshing || pull > 0
  const armed = pull >= TRIGGER_PX * 0.5

  return (
    <main
      ref={(el) => {
        scroller.current = el
      }}
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Indikator: fährt beim Ziehen aus, dreht während der Aktualisierung */}
      <div
        aria-hidden={!active}
        className="pointer-events-none flex justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: refreshing ? 40 : pull * 0.45 }}
      >
        <RefreshCw
          className={cn(
            'mt-2 h-5 w-5 text-muted-foreground transition-transform',
            refreshing && 'animate-spin text-primary',
            !refreshing && armed && 'rotate-180 text-primary',
          )}
        />
      </div>
      {children}
    </main>
  )
}

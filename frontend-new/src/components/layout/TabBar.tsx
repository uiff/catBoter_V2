import { motion } from 'framer-motion'
import { CalendarClock, ChartColumn, House, Settings2 } from 'lucide-react'
import { useUiStore, type Tab } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { BrandLogo } from './BrandLogo'

const TABS: Array<{ id: Tab; label: string; icon: typeof House }> = [
  { id: 'dashboard', label: 'Übersicht', icon: House },
  { id: 'plans', label: 'Fütterung', icon: CalendarClock },
  { id: 'stats', label: 'Statistik', icon: ChartColumn },
  { id: 'settings', label: 'System', icon: Settings2 },
]

/**
 * Mobil: fixe Bottom-Tab-Bar mit Safe-Area.
 * Desktop (md+): schmale Icon-Rail links mit Wortmarke.
 */
export function TabBar() {
  const tab = useUiStore((s) => s.tab)
  const setTab = useUiStore((s) => s.setTab)

  return (
    <nav
      aria-label="Hauptnavigation"
      className={cn(
        // Mobil: normales Flex-Element am unteren Ende der App-Shell
        // (KEIN fixed - iOS platziert fixed-Elemente beim PWA-Start falsch)
        'z-40 shrink-0 border-t border-border bg-surface pb-safe',
        // Desktop: linke Rail (fixed ist am Desktop unproblematisch)
        'md:fixed md:inset-y-0 md:left-0 md:w-[76px] md:border-r md:border-t-0 md:pb-0',
      )}
    >
      <div className="hidden justify-center px-3 pb-2 pt-5 md:flex">
        <BrandLogo className="h-4 text-foreground" />
      </div>
      <div className="flex md:flex-col md:gap-1 md:px-2 md:pt-4">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] transition-colors md:flex-none md:py-2.5',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              style={{ minHeight: 'var(--tabbar-h)' }}
            >
              {/* Der eine Motion-Moment der App: der aktive Pill gleitet
                  zwischen den Tabs (framer-motion layoutId) */}
              <span className="relative flex h-7 w-14 items-center justify-center">
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-primary-soft"
                    transition={{ type: 'spring', bounce: 0.22, duration: 0.5 }}
                  />
                )}
                <Icon className="relative h-5 w-5" />
              </span>
              <span className={cn(active ? 'font-semibold' : 'font-medium')}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

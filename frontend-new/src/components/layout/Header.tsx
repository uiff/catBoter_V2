import { Wifi, WifiOff } from 'lucide-react'
import { useConnection } from '@/stores/socketStore'
import { cn } from '@/lib/utils'
import { BrandLogo } from './BrandLogo'

export function Header() {
  const connection = useConnection()
  const online = connection === 'online'

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 pt-safe backdrop-blur md:hidden"
      style={{ minHeight: 'var(--header-h)' }}
    >
      <BrandLogo className="h-[18px] text-foreground" />
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          online ? 'text-success' : 'text-danger',
        )}
        title={online ? 'Verbunden' : 'Keine Verbindung'}
      >
        {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <span
          className={cn('h-2 w-2 rounded-full', online ? 'bg-success' : 'bg-danger animate-pulse')}
        />
      </div>
    </header>
  )
}

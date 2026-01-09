import { Menu, Wifi, WifiOff } from 'lucide-react'

interface HeaderProps {
  title: string
  isConnected: boolean
  onMenuClick?: () => void
}

export function Header({ title, isConnected, onMenuClick }: HeaderProps) {
  return (
    <header className="glass border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <button onClick={onMenuClick} className="md:hidden">
              <Menu className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2 text-green-500">
              <Wifi className="w-4 h-4" />
              <span className="text-xs font-medium">Verbunden</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500">
              <WifiOff className="w-4 h-4" />
              <span className="text-xs font-medium">Offline</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

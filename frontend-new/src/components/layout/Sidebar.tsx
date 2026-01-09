import { Home, Utensils, BarChart3, Settings, PawPrint } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
}

const navItems = [
  { id: 'dashboard', label: 'Übersicht', icon: Home },
  { id: 'feed', label: 'Fütterung', icon: Utensils },
  { id: 'monitor', label: 'Monitoring', icon: BarChart3 },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
]

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <div className="w-64 h-screen glass border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <PawPrint className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">catBoter</h1>
            <p className="text-xs text-muted-foreground">Smart Feeder</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg',
                'transition-all duration-200',
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'glass-hover text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">© 2024 iotueli</p>
      </div>
    </div>
  )
}

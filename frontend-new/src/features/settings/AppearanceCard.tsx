import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { SegmentedControl } from '@/components/ui/Misc'
import { useUiStore, type Theme } from '@/stores/uiStore'

/** Darstellung: Hell/Dunkel/System - wirkt sofort, wird lokal gespeichert. */
export function AppearanceCard() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  return (
    <CollapsibleCard title="Darstellung" icon={<Palette className="h-4 w-4" />} defaultOpen>
      <div className="pt-1">
        <SegmentedControl<Theme>
          options={[
            { value: 'system', label: 'System', icon: Monitor },
            { value: 'light', label: 'Hell', icon: Sun },
            { value: 'dark', label: 'Dunkel', icon: Moon },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </div>
    </CollapsibleCard>
  )
}

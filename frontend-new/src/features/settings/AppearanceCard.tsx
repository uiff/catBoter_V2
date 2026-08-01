import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/Misc'
import { useUiStore, type Theme } from '@/stores/uiStore'

/** Darstellung: Hell/Dunkel/System - wirkt sofort, wird lokal gespeichert. */
export function AppearanceCard() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  return (
    <Card>
      <CardHeader title="Darstellung" icon={<Palette className="h-4 w-4" />} />
      <CardContent>
        <SegmentedControl<Theme>
          options={[
            { value: 'system', label: 'System', icon: Monitor },
            { value: 'light', label: 'Hell', icon: Sun },
            { value: 'dark', label: 'Dunkel', icon: Moon },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </CardContent>
    </Card>
  )
}

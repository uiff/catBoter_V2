import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Utensils } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Skeleton, Switch } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'

/** Fütterung: Smart-Feed-Schalter (Backend-Einstellung, wirkt sofort). */
export function FeedingCard() {
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })

  // Optimistischer Override während des Speicherns - null = Serverstand anzeigen.
  const [override, setOverride] = useState<boolean | null>(null)
  const checked = override ?? settings.data?.smart_feed ?? false

  const toggle = async (value: boolean) => {
    setOverride(value)
    try {
      await api.setAppSettings({ smart_feed: value })
      await queryClient.invalidateQueries({ queryKey: ['app-settings'] })
      setOverride(null)
    } catch (e) {
      setOverride(null) // zurück auf den Serverstand
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    }
  }

  return (
    <Card>
      <CardHeader title="Fütterung" icon={<Utensils className="h-4 w-4" />} />
      <CardContent>
        {settings.isLoading ? (
          <Skeleton className="h-11 w-full" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Smart-Feed</p>
              <Switch checked={checked} onChange={toggle} label="Smart-Feed" />
            </div>
            <p className="pt-1.5 text-xs text-muted-foreground">
              Liegt noch Futter im Napf, wird bei Plan-Fütterungen nur die Differenz dosiert.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

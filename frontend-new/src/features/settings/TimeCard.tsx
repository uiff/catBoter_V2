import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Misc'
import { api } from '@/lib/api'
import { formatIsoTime } from '@/lib/format'

/** Zeit: reine Anzeige - Uhrzeit und NTP verwaltet das Host-System. */
export function TimeCard() {
  const time = useQuery({
    queryKey: ['time-status'],
    queryFn: api.getTimeStatus,
    refetchInterval: 30_000,
  })

  return (
    <Card>
      <CardHeader title="Zeit" icon={<Clock className="h-4 w-4" />} />
      <CardContent className="space-y-3">
        {time.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Uhrzeit</span>
              <span className="tnum font-medium">{formatIsoTime(time.data?.current_time)}</span>
            </div>
            <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Zeitzone</span>
              <span className="font-medium">{time.data?.timezone ?? '–'}</span>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Zeit und NTP verwaltet das Host-System.</p>
      </CardContent>
    </Card>
  )
}

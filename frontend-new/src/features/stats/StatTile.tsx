import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Misc'

interface StatTileProps {
  caption: string
  value: string
  sub?: string
  loading?: boolean
}

/** Kompakte Kennzahl-Kachel: Beschriftung, grosser Wert, optionale Zusatzzeile. */
export function StatTile({ caption, value, sub, loading }: StatTileProps) {
  return (
    <Card>
      <CardContent className="space-y-1 p-3">
        <p className="text-xs text-muted-foreground">{caption}</p>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="tnum text-2xl font-semibold">{value}</p>
        )}
        {!loading && sub && <p className="tnum text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

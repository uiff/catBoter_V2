import { Clock, Check, X, User } from 'lucide-react'
import { formatGrams } from '@/lib/utils'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface Feeding {
  time: string
  amount: number
  type?: 'auto' | 'manual'  // auto = geplant, manual = manuell
  status?: boolean | null    // true = durchgeführt, false/null = ausstehend
  planned_amount?: number    // geplante Menge (nur bei auto)
}

interface RecentFeedingsProps {
  feedings: Feeding[]
  date?: string
}

export function RecentFeedings({ feedings, date }: RecentFeedingsProps) {
  const displayDate = date || format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Heutige Fütterungen</h3>
        <span className="text-sm text-muted-foreground">
          {format(new Date(displayDate), 'd. MMMM', { locale: de })}
        </span>
      </div>

      {feedings.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Noch keine Fütterungen heute</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedings.map((feeding, idx) => {
            const now = new Date()
            const feedingTime = new Date(`${displayDate}T${feeding.time}`)
            const isPast = feedingTime < now
            const hasAmount = feeding.amount > 0
            const isManual = feeding.type === 'manual'
            const isCompleted = feeding.status === true

            // Grüne Markierung für durchgeführte Fütterungen
            const isSuccess = isCompleted && hasAmount

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isSuccess
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-background/30 border-border/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isSuccess
                      ? 'bg-green-500/20'
                      : isPast
                        ? hasAmount
                          ? 'bg-primary/20'
                          : 'bg-destructive/20'
                        : 'bg-muted/20'
                  }`}>
                    {isSuccess ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : isManual ? (
                      <User className="w-5 h-5 text-blue-500" />
                    ) : isPast ? (
                      hasAmount ? (
                        <Check className="w-5 h-5 text-primary" />
                      ) : (
                        <X className="w-5 h-5 text-destructive" />
                      )
                    ) : (
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{feeding.time} Uhr</p>
                    <p className="text-sm text-muted-foreground">
                      {isManual ? (
                        'Manuell'
                      ) : isSuccess ? (
                        'Automatisch durchgeführt'
                      ) : isPast ? (
                        hasAmount ? 'Erledigt' : 'Übersprungen'
                      ) : (
                        'Geplant'
                      )}
                    </p>
                  </div>
                </div>
                <div className={`text-right ${
                  isSuccess
                    ? 'text-green-500'
                    : isPast
                      ? hasAmount
                        ? 'text-primary'
                        : 'text-muted-foreground'
                      : 'text-muted-foreground'
                }`}>
                  <p className="font-semibold">
                    {formatGrams(feeding.amount)}
                  </p>
                  {feeding.planned_amount && feeding.planned_amount !== feeding.amount && (
                    <p className="text-xs text-muted-foreground">
                      Soll: {formatGrams(feeding.planned_amount)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

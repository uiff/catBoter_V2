import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, Scale, Square, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Button } from '@/components/ui/Button'
import { ProgressBar, SegmentedControl, Stepper } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { formatGrams } from '@/lib/format'
import { MANUAL_FEED_MAX_G, MANUAL_FEED_MIN_G, QUICK_AMOUNTS } from '@/lib/constants'
import { clearFeedingResult, useFeeding, useSensor } from '@/stores/socketStore'
import { cn } from '@/lib/utils'

interface ManualFeedSheetProps {
  open: boolean
  onClose: () => void
}

type SlowMinutes = '0' | '5' | '10'

export function ManualFeedSheet({ open, onClose }: ManualFeedSheetProps) {
  const [amount, setAmount] = useState<number>(20)
  const [slowMinutes, setSlowMinutes] = useState<SlowMinutes>('0')
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [confirmOverBudget, setConfirmOverBudget] = useState(false)
  const feeding = useFeeding()
  const sensor = useSensor()

  // Diät-Budget: manuelles Füttern wird nicht blockiert, aber gewarnt
  const diet = useQuery({
    queryKey: ['diet-status'],
    queryFn: api.getDietStatus,
    enabled: open,
    staleTime: 30_000,
  })
  const dietRemaining =
    diet.data?.enabled && diet.data.budget_today !== null ? diet.data.remaining ?? 0 : null
  const overBudget = dietRemaining !== null && amount > dietRemaining

  const active = feeding?.active ?? false
  // Nur MANUELLE Ergebnisse in diesem Sheet anzeigen - das Resultat einer
  // Plan-Fütterung darf einen späteren manuellen Feed nicht kapern
  const result =
    !feeding?.active && feeding?.result?.source === 'manual' ? feeding.result : null

  // Beim Öffnen ein evtl. liegengebliebenes altes Ergebnis wegräumen
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      clearFeedingResult()
    }
    wasOpen.current = open
  }, [open])

  // Nach Abschluss: Ergebnis 2.5 s zeigen, dann automatisch schliessen
  useEffect(() => {
    if (open && result) {
      const timer = setTimeout(() => {
        clearFeedingResult()
        onClose()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [open, result, onClose])

  const handleClose = () => {
    clearFeedingResult()
    onClose()
  }

  const startFeed = async () => {
    setConfirmOverBudget(false)
    setStarting(true)
    try {
      await api.manualFeed(amount, Number(slowMinutes))
      // Fortschritt kommt über die Socket-Events
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Fütterung konnte nicht gestartet werden')
    } finally {
      setStarting(false)
    }
  }

  // Über dem Diät-Budget erst bestätigen lassen, dann füttern
  const requestFeed = () => {
    if (overBudget) setConfirmOverBudget(true)
    else void startFeed()
  }

  const stopFeed = async () => {
    setStopping(true)
    try {
      await api.stopFeeding()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Stopp fehlgeschlagen')
    } finally {
      setStopping(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Manuelle Fütterung"
      locked={active}
    >
      {/* Ergebnis-Ansicht */}
      {result ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          {result.success ? (
            <CircleCheck className="h-14 w-14 text-success" />
          ) : (
            <CircleX className="h-14 w-14 text-danger" />
          )}
          <p className="text-xl font-semibold tnum">{formatGrams(result.fed_grams)} ausgegeben</p>
          <p className="max-w-72 text-sm text-muted-foreground">{result.message}</p>
        </div>
      ) : active ? (
        /* Live-Ansicht während der Fütterung */
        <div className="space-y-5 py-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {feeding!.source === 'manual' ? 'Fütterung läuft' : 'Plan-Fütterung läuft'}
            </p>
            <p className="tnum pt-1 text-3xl font-semibold">
              {formatGrams(feeding!.fed_grams)}
              <span className="text-lg font-normal text-muted-foreground">
                {' '}/ {formatGrams(feeding!.target_grams)}
              </span>
            </p>
          </div>
          <ProgressBar value={feeding!.fed_grams} max={feeding!.target_grams} className="h-3" />
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            onClick={stopFeed}
            loading={stopping}
          >
            <Square className="h-4 w-4" />
            Stoppen
          </Button>
        </div>
      ) : (
        /* Auswahl-Ansicht */
        <div className="space-y-5">
          <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
            <Scale className="h-4 w-4" />
            Aktuelles Napfgewicht:
            <span className="tnum ml-auto font-medium text-foreground">
              {formatGrams(sensor?.weight ?? null)}
            </span>
          </div>

          <div>
            <p className="pb-2 text-sm font-medium">Menge wählen</p>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((quick) => (
                <button
                  key={quick}
                  onClick={() => setAmount(quick)}
                  className={cn(
                    'tnum rounded-md border py-3 text-sm font-semibold transition-colors',
                    amount === quick
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-surface hover:bg-surface-2',
                  )}
                >
                  {quick} g
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="pb-2 text-sm font-medium">Oder anpassen</p>
            <Stepper
              value={amount}
              onChange={setAmount}
              min={MANUAL_FEED_MIN_G}
              max={MANUAL_FEED_MAX_G}
              step={5}
              suffix="g"
            />
          </div>

          <div>
            <p className="pb-2 text-sm font-medium">Anti-Schling</p>
            <SegmentedControl<SlowMinutes>
              options={[
                { value: '0', label: 'Aus' },
                { value: '5', label: '5 min' },
                { value: '10', label: '10 min' },
              ]}
              value={slowMinutes}
              onChange={setSlowMinutes}
            />
          </div>

          {overBudget && (
            <div className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              <Target className="h-4 w-4 shrink-0" />
              <span className="tnum">
                Diät-Budget: heute nur noch {formatGrams(dietRemaining)} übrig
              </span>
            </div>
          )}

          <Button size="lg" className="w-full" onClick={requestFeed} loading={starting}>
            {formatGrams(amount)} füttern
          </Button>
        </div>
      )}

      <ConfirmSheet
        open={confirmOverBudget}
        onClose={() => setConfirmOverBudget(false)}
        onConfirm={startFeed}
        title="Über dem Diät-Budget"
        description={`Heute sind nur noch ${formatGrams(dietRemaining ?? 0)} im Diät-Budget übrig. ${formatGrams(amount)} trotzdem füttern?`}
        confirmLabel="Trotzdem füttern"
        danger
        loading={starting}
      />
    </Sheet>
  )
}

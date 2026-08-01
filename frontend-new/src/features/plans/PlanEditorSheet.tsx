/** Vollhöhen-Sheet zum Erstellen und Bearbeiten von Fütterungsplänen (beide Typen). */
import { useState } from 'react'
import { ChevronLeft, Clock, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Stepper, Switch } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'
import { cn } from '@/lib/utils'
import { ALL_DAYS, type AutoPlan, type RandomPlan, type ScheduledFeeding } from '@/types/feeding'
import type { PlanItem } from './PlanCard'

type PlanType = 'auto' | 'random'
type Step = 'choose' | PlanType

interface PlanEditorSheetProps {
  open: boolean
  onClose: () => void
  /** null = neuen Plan erstellen */
  editing: PlanItem | null
}

export function PlanEditorSheet({ open, onClose, editing }: PlanEditorSheetProps) {
  // Beim Erstellen gewählter Plantyp; wird beim Schliessen zurückgesetzt.
  const [chosenType, setChosenType] = useState<PlanType | null>(null)
  const step: Step = editing ? editing.kind : chosenType ?? 'choose'

  const handleClose = () => {
    setChosenType(null)
    onClose()
  }

  const title = editing
    ? 'Plan bearbeiten'
    : step === 'choose'
      ? 'Neuer Plan'
      : step === 'auto'
        ? 'Neuer Plan – Feste Zeiten'
        : 'Neuer Plan – Zufällig'

  return (
    <Sheet open={open} onClose={handleClose} title={title} full>
      {step === 'choose' ? (
        <TypeChooser onSelect={setChosenType} />
      ) : (
        <>
          {!editing && (
            <button
              onClick={() => setChosenType(null)}
              className="mb-3 flex h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Plantyp ändern
            </button>
          )}
          {step === 'auto' ? (
            <AutoPlanForm
              initial={editing?.kind === 'auto' ? editing.plan : undefined}
              onDone={handleClose}
            />
          ) : (
            <RandomPlanForm
              initial={editing?.kind === 'random' ? editing.plan : undefined}
              onDone={handleClose}
            />
          )}
        </>
      )}
    </Sheet>
  )
}

/* ------------------------------- Typwahl ------------------------------- */

function TypeChooser({ onSelect }: { onSelect: (type: PlanType) => void }) {
  return (
    <div className="space-y-3 pt-1">
      <p className="text-sm text-muted-foreground">Wie soll gefüttert werden?</p>

      <button
        onClick={() => onSelect('auto')}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-2"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Clock className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Feste Zeiten</span>
          <span className="block text-sm text-muted-foreground">
            Fütterungen zu festen Uhrzeiten an ausgewählten Wochentagen
          </span>
        </span>
      </button>

      <button
        onClick={() => onSelect('random')}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-2"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Shuffle className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Zufällig</span>
          <span className="block text-sm text-muted-foreground">
            Zufällige Zeiten innerhalb eines Zeitfensters, jeden Tag neu
          </span>
        </span>
      </button>
    </div>
  )
}

/* --------------------------- Feste Zeiten (Auto) --------------------------- */

const TIME_DEFAULTS = ['08:00', '12:00', '18:00', '21:00', '06:30', '10:00', '15:00', '23:00']

function AutoPlanForm({ initial, onDone }: { initial?: AutoPlan; onDone: () => void }) {
  const firstDay = initial?.selectedDays[0]
  const initialFeedings = (initial && firstDay ? initial.feedingSchedule[firstDay] : undefined) ?? []
  const initialTimes = initialFeedings.map((f) => f.time.slice(0, 5)).sort()
  const initialDaily = initial
    ? initial.dailyWeight ?? Math.round(initialFeedings.reduce((sum, f) => sum + f.weight, 0))
    : 60

  const [name, setName] = useState(initial?.planName ?? '')
  const [days, setDays] = useState<string[]>(initial?.selectedDays ?? [...ALL_DAYS])
  const [dailyWeight, setDailyWeight] = useState(initialDaily > 0 ? initialDaily : 60)
  const [times, setTimes] = useState<string[]>(
    initialTimes.length > 0 ? initialTimes : ['08:00', '18:00'],
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const perFeeding = times.length > 0 ? Math.round((dailyWeight / times.length) * 10) / 10 : 0

  const toggleDay = (day: string) => {
    setDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : ALL_DAYS.filter((d) => prev.includes(d) || d === day),
    )
  }

  const setCount = (count: number) => {
    setTimes((prev) => {
      if (count <= prev.length) return prev.slice(0, count)
      const next = [...prev]
      while (next.length < count) next.push(TIME_DEFAULTS[next.length % TIME_DEFAULTS.length])
      return next
    })
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    if (days.length === 0) {
      setError('Mindestens einen Wochentag auswählen.')
      return
    }
    if (times.some((t) => !t)) {
      setError('Bitte alle Uhrzeiten ausfüllen.')
      return
    }
    setError(null)

    const sortedTimes = [...times].sort()
    const feedingSchedule: Record<string, ScheduledFeeding[]> = {}
    for (const day of days) {
      feedingSchedule[day] = sortedTimes.map((time) => ({ time, weight: perFeeding }))
    }
    const plan: AutoPlan = {
      planName: trimmed,
      selectedDays: days,
      feedingSchedule,
      weightMode: 'daily',
      dailyWeight,
      active: initial?.active ?? false,
    }

    setSaving(true)
    try {
      if (initial) await api.updateAutoPlan(initial.planName, plan)
      else await api.createAutoPlan(plan)
      toast.success(initial ? 'Plan gespeichert' : 'Plan erstellt')
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      onDone()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <Input
        label="Name"
        placeholder="z. B. Wochenplan"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
      />

      <div>
        <p className="pb-2 text-sm font-medium">Wochentage</p>
        <div className="grid grid-cols-7 gap-1.5">
          {ALL_DAYS.map((day) => {
            const selected = days.includes(day)
            return (
              <button
                key={day}
                aria-pressed={selected}
                aria-label={day}
                onClick={() => toggleDay(day)}
                className={cn(
                  'h-11 rounded-md border text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border bg-surface text-muted-foreground hover:bg-surface-2',
                )}
              >
                {day.slice(0, 2)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="pb-2 text-sm font-medium">Tagesmenge</p>
        <Stepper value={dailyWeight} onChange={setDailyWeight} min={10} max={500} step={5} suffix="g" />
      </div>

      <div>
        <p className="pb-2 text-sm font-medium">Fütterungen pro Tag</p>
        <Stepper value={times.length} onChange={setCount} min={1} max={8} />
        <p className="tnum pt-1.5 text-xs text-muted-foreground">= {perFeeding} g pro Fütterung</p>
      </div>

      <div>
        <p className="pb-2 text-sm font-medium">Uhrzeiten</p>
        <div className="grid grid-cols-2 gap-2">
          {times.map((time, index) => (
            <Input
              key={index}
              type="time"
              aria-label={`Fütterung ${index + 1}`}
              value={time}
              className="tnum"
              onChange={(e) =>
                setTimes((prev) => prev.map((t, i) => (i === index ? e.target.value : t)))
              }
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button size="lg" className="w-full" onClick={save} loading={saving}>
        {initial ? 'Speichern' : 'Plan erstellen'}
      </Button>
    </div>
  )
}

/* ----------------------------- Zufall (Random) ----------------------------- */

function RandomPlanForm({ initial, onDone }: { initial?: RandomPlan; onDone: () => void }) {
  const [name, setName] = useState(initial?.planName ?? '')
  const [startTime, setStartTime] = useState(initial ? initial.startTime.slice(0, 5) : '07:00')
  const [endTime, setEndTime] = useState(initial ? initial.endTime.slice(0, 5) : '21:00')
  const [dailyWeight, setDailyWeight] = useState(initial?.dailyWeight ?? 60)
  const [minInterval, setMinInterval] = useState(initial?.minInterval ?? 120)
  const [maxInterval, setMaxInterval] = useState(initial?.maxInterval ?? 300)
  const [minPause, setMinPause] = useState(initial?.minPause ?? 60)
  const [workdaysOnly, setWorkdaysOnly] = useState(initial?.workdaysOnly ?? false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    if (!startTime || !endTime || startTime >= endTime) {
      setError('Die Startzeit muss vor der Endzeit liegen.')
      return
    }
    if (minInterval > maxInterval) {
      setError('Das Min-Intervall darf nicht grösser als das Max-Intervall sein.')
      return
    }
    setError(null)

    // Wichtig: minInterval, maxInterval UND minPause werden immer alle gesendet.
    const plan: RandomPlan = {
      planName: trimmed,
      active: initial?.active ?? false,
      startTime,
      endTime,
      minInterval,
      maxInterval,
      minPause,
      dailyWeight,
      workdaysOnly,
    }

    setSaving(true)
    try {
      if (initial) await api.updateRandomPlan(initial.planName, plan)
      else await api.createRandomPlan(plan)
      toast.success(initial ? 'Plan gespeichert' : 'Plan erstellt')
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      onDone()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <Input
        label="Name"
        placeholder="z. B. Zufallsfütterung"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
      />

      <div>
        <p className="pb-2 text-sm font-medium">Zeitfenster</p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="time"
            label="Start"
            value={startTime}
            className="tnum"
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            type="time"
            label="Ende"
            value={endTime}
            className="tnum"
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="pb-2 text-sm font-medium">Tagesmenge</p>
        <Stepper value={dailyWeight} onChange={setDailyWeight} min={10} max={500} step={5} suffix="g" />
      </div>

      <div>
        <p className="pb-2 text-sm font-medium">Min. Intervall zwischen Fütterungen</p>
        <Stepper value={minInterval} onChange={setMinInterval} min={30} max={480} step={15} suffix="min" />
      </div>

      <div>
        <p className="pb-2 text-sm font-medium">Max. Intervall zwischen Fütterungen</p>
        <Stepper value={maxInterval} onChange={setMaxInterval} min={30} max={480} step={15} suffix="min" />
      </div>

      <div>
        <p className="pb-2 text-sm font-medium">Mindestpause</p>
        <Stepper value={minPause} onChange={setMinPause} min={15} max={240} step={15} suffix="min" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Nur Wochentage</p>
          <p className="text-xs text-muted-foreground">Am Wochenende nicht automatisch füttern</p>
        </div>
        <Switch checked={workdaysOnly} onChange={setWorkdaysOnly} label="Nur Wochentage" />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button size="lg" className="w-full" onClick={save} loading={saving}>
        {initial ? 'Speichern' : 'Plan erstellen'}
      </Button>
    </div>
  )
}

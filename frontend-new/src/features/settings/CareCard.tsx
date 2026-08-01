import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Plus, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Skeleton, Stepper } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { queryClient } from '@/App'
import type { Reminder } from '@/types/api'

/** Lokales Datum als "YYYY-MM-DD" (toISOString wäre UTC und kippt abends den Tag). */
function todayLocalIso(): string {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "YYYY-MM-DD..." -> "DD.MM.YYYY" */
function formatDueDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return iso
  return `${day}.${month}.${year}`
}

function foodAgeLabel(days: number): string {
  return days === 1 ? '1 Tag alt' : `${days} Tage alt`
}

function cleanedLabel(days: number | null): string {
  if (days === null) return '–'
  if (days === 0) return 'heute'
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`
}

interface CleanRowProps {
  label: string
  days: number | null
  due: boolean
  busy: boolean
  onDone: () => void
}

/** Reinigungszeile: Wert + "Erledigt"-Knopf, warnt wenn überfällig. */
function CleanRow({ label, days, due, busy, onDone }: CleanRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={cn('tnum font-medium', due && 'text-warning')}>{cleanedLabel(days)}</span>
        <Button variant="ghost" size="sm" onClick={onDone} loading={busy}>
          {!busy && <Check className="h-4 w-4" />}
          Erledigt
        </Button>
      </div>
    </div>
  )
}

/** Pflege: Frische von Futter/Napf/Tank plus freie Erinnerungen (Entwurmung, Impfung, …). */
export function CareCard() {
  const freshness = useQuery({
    queryKey: ['freshness'],
    queryFn: api.getFreshness,
    refetchInterval: 60_000,
  })
  const reminders = useQuery({ queryKey: ['reminders'], queryFn: api.getReminders })

  const [cleaning, setCleaning] = useState<'bowl' | 'tank' | null>(null)
  const [doneBusyId, setDoneBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const fresh = freshness.data
  const today = todayLocalIso()

  const markCleaned = async (what: 'bowl' | 'tank') => {
    setCleaning(what)
    try {
      await api.markCleaned(what)
      toast.success(what === 'bowl' ? 'Napf-Reinigung vermerkt' : 'Tank-Reinigung vermerkt')
      queryClient.invalidateQueries({ queryKey: ['freshness'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setCleaning(null)
    }
  }

  const markDone = async (reminder: Reminder) => {
    setDoneBusyId(reminder.id)
    try {
      await api.reminderDone(reminder.id)
      toast.success(`Erledigt - nächste Fälligkeit in ${reminder.interval_days} Tagen`)
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Aktion fehlgeschlagen')
    } finally {
      setDoneBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteReminder(deleteTarget.id)
      toast.success('Erinnerung gelöscht')
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Löschen fehlgeschlagen')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Pflege" icon={<Sparkles className="h-4 w-4" />} />
      <CardContent className="space-y-3">
        {freshness.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <>
            <div className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Futter im Tank</span>
                {fresh && fresh.food_age_days !== null ? (
                  <span
                    className={cn(
                      'tnum inline-flex items-center gap-1.5 font-medium',
                      fresh.food_stale && 'text-warning',
                    )}
                  >
                    {fresh.food_stale && <TriangleAlert className="h-4 w-4 shrink-0" />}
                    {foodAgeLabel(fresh.food_age_days)}
                  </span>
                ) : (
                  <span className="font-medium">–</span>
                )}
              </div>
              {(!fresh || fresh.food_age_days === null) && (
                <p className="pt-1 text-xs text-muted-foreground">
                  wird bei der nächsten Auffüllung erkannt
                </p>
              )}
            </div>

            <CleanRow
              label="Napf gereinigt"
              days={fresh?.bowl_clean_days ?? null}
              due={fresh?.bowl_due ?? false}
              busy={cleaning === 'bowl'}
              onDone={() => markCleaned('bowl')}
            />
            <CleanRow
              label="Tank gereinigt"
              days={fresh?.tank_clean_days ?? null}
              due={fresh?.tank_due ?? false}
              busy={cleaning === 'tank'}
              onDone={() => markCleaned('tank')}
            />
          </>
        )}

        <div className="border-t border-border pt-3">
          <p className="pb-1 text-sm font-medium">Erinnerungen</p>

          {reminders.isLoading ? (
            <div className="space-y-2 pt-1">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !reminders.data || reminders.data.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">Keine Erinnerungen</p>
          ) : (
            <ul className="divide-y divide-border">
              {reminders.data.map((reminder) => {
                const overdue = reminder.next_due.slice(0, 10) <= today
                return (
                  <li key={reminder.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{reminder.title}</p>
                        {reminder.cat && (
                          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                            {reminder.cat}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          'tnum pt-0.5 text-xs',
                          overdue ? 'text-danger' : 'text-muted-foreground',
                        )}
                      >
                        fällig {formatDueDate(reminder.next_due)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        aria-label={`"${reminder.title}" erledigt`}
                        onClick={() => markDone(reminder)}
                        loading={doneBusyId === reminder.id}
                      >
                        {doneBusyId !== reminder.id && <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2 text-danger hover:bg-danger-soft"
                        aria-label={`"${reminder.title}" löschen`}
                        onClick={() => setDeleteTarget(reminder)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Neue Erinnerung
        </Button>
      </CardContent>

      <AddReminderSheet open={addOpen} onClose={() => setAddOpen(false)} />

      <ConfirmSheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Erinnerung löschen?"
        description={
          deleteTarget ? `"${deleteTarget.title}" wird dauerhaft gelöscht.` : undefined
        }
        confirmLabel="Löschen"
        danger
        loading={deleting}
      />
    </Card>
  )
}

/** Neue Erinnerung anlegen - Titel, optionale Katze, Intervall und erste Fälligkeit. */
function AddReminderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [cat, setCat] = useState('')
  const [intervalDays, setIntervalDays] = useState(90)
  const [dueDate, setDueDate] = useState(todayLocalIso())
  const [titleError, setTitleError] = useState(false)
  const [saving, setSaving] = useState(false)

  // Beim Öffnen immer mit leerem Formular starten
  useEffect(() => {
    if (open) {
      setTitle('')
      setCat('')
      setIntervalDays(90)
      setDueDate(todayLocalIso())
      setTitleError(false)
    }
  }, [open])

  const save = async () => {
    if (title.trim() === '') {
      setTitleError(true)
      return
    }
    setSaving(true)
    try {
      await api.addReminder({
        title: title.trim(),
        interval_days: intervalDays,
        next_due: dueDate,
        ...(cat.trim() !== '' ? { cat: cat.trim() } : {}),
      })
      toast.success('Erinnerung angelegt')
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      onClose()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Neue Erinnerung">
      <div className="space-y-4">
        <div>
          <Input
            label="Titel"
            value={title}
            maxLength={60}
            placeholder="z. B. Entwurmung"
            onChange={(e) => {
              setTitle(e.target.value)
              if (titleError) setTitleError(false)
            }}
          />
          {titleError && <p className="pt-1 text-xs text-danger">Titel ist erforderlich</p>}
        </div>

        <Input
          label="Katze"
          value={cat}
          maxLength={30}
          placeholder="beide"
          onChange={(e) => setCat(e.target.value)}
        />

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Intervall</p>
          <Stepper
            value={intervalDays}
            onChange={setIntervalDays}
            min={7}
            max={365}
            step={7}
            suffix="Tage"
          />
        </div>

        <Input
          label="Fälligkeitsdatum"
          type="date"
          className="tnum"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <Button
          size="lg"
          className="w-full"
          onClick={save}
          loading={saving}
          disabled={dueDate === ''}
        >
          Speichern
        </Button>
      </div>
    </Sheet>
  )
}

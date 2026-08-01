/** Sheet zum Pausieren aller geplanten Fütterungen (Urlaubsmodus). */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'

interface PauseSheetProps {
  open: boolean
  onClose: () => void
}

/** Date -> Wert für <input type="datetime-local"> (lokale Zeit, "YYYY-MM-DDTHH:MM") */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function PauseSheet({ open, onClose }: PauseSheetProps) {
  const [custom, setCustom] = useState('')

  const pause = useMutation({
    mutationFn: (iso: string) => api.setAppSettings({ paused_until: iso }),
    onSuccess: () => {
      toast.success('Fütterungen pausiert')
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
      setCustom('')
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Pausieren fehlgeschlagen'),
  })

  const pauseUntilEvening = () => {
    const until = new Date()
    until.setHours(22, 0, 0, 0)
    // Nach 22:00 wäre der Zeitpunkt bereits vorbei -> nächster Abend
    if (until.getTime() <= Date.now()) until.setDate(until.getDate() + 1)
    pause.mutate(toDatetimeLocal(until))
  }

  const pauseForHours = (hours: number) => {
    pause.mutate(toDatetimeLocal(new Date(Date.now() + hours * 60 * 60 * 1000)))
  }

  const customDate = custom ? new Date(custom) : null
  const customValid =
    customDate !== null && !Number.isNaN(customDate.getTime()) && customDate.getTime() > Date.now()

  return (
    <Sheet open={open} onClose={onClose} title="Fütterungen pausieren">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Geplante Fütterungen werden ausgesetzt. Manuelles Füttern bleibt möglich.
        </p>

        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={pauseUntilEvening}
            disabled={pause.isPending}
          >
            Bis heute Abend (22:00)
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => pauseForHours(24)}
            disabled={pause.isPending}
          >
            24 Stunden
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => pauseForHours(7 * 24)}
            disabled={pause.isPending}
          >
            1 Woche
          </Button>
        </div>

        <div className="space-y-2">
          <Input
            type="datetime-local"
            label="Eigener Zeitpunkt"
            value={custom}
            min={toDatetimeLocal(new Date())}
            className="tnum"
            onChange={(e) => setCustom(e.target.value)}
          />
          <Button
            className="w-full"
            onClick={() => customDate && pause.mutate(toDatetimeLocal(customDate))}
            disabled={!customValid}
            loading={pause.isPending}
          >
            Pausieren
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

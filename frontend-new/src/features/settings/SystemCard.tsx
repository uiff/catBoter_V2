import { useState } from 'react'
import { Power, RefreshCw, RotateCcw, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { api, ApiError } from '@/lib/api'

type Action = 'restart' | 'reboot' | 'shutdown'

const ACTIONS: Record<
  Action,
  { title: string; description: string; confirmLabel: string; danger: boolean }
> = {
  restart: {
    title: 'Backend neu starten',
    description:
      'Der CatBoter-Dienst wird neu gestartet. Die Oberfläche ist danach für einige Sekunden nicht erreichbar; laufende Fütterungen werden abgebrochen.',
    confirmLabel: 'Neu starten',
    danger: false,
  },
  reboot: {
    title: 'Gerät neu starten',
    description:
      'Das Gerät startet vollständig neu und ist etwa eine Minute lang nicht erreichbar.',
    confirmLabel: 'Neustart',
    danger: true,
  },
  shutdown: {
    title: 'Gerät herunterfahren',
    description:
      'Das Gerät fährt herunter und füttert danach NICHT mehr. Zum Wiedereinschalten muss die Stromversorgung manuell getrennt und wieder verbunden werden.',
    confirmLabel: 'Herunterfahren',
    danger: true,
  },
}

/** Wartung: Backend-Neustart, Geräte-Neustart und Herunterfahren - jeweils mit Bestätigung. */
export function SystemCard() {
  const [confirm, setConfirm] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm === 'restart') {
        await api.restartBackend()
        toast.success('Backend startet neu…')
      } else if (confirm === 'reboot') {
        const res = await api.rebootHost()
        toast.success(res.message || 'Neustart eingeleitet')
      } else {
        const res = await api.shutdownHost()
        toast.success(res.message || 'Herunterfahren eingeleitet')
      }
      setConfirm(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Aktion fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const active = confirm ? ACTIONS[confirm] : null

  return (
    <CollapsibleCard title="Wartung" icon={<Wrench className="h-4 w-4" />}>
      <div className="space-y-2 pt-1">
        <Button variant="secondary" className="w-full" onClick={() => setConfirm('restart')}>
          <RefreshCw className="h-4 w-4" />
          Backend neu starten
        </Button>
        <Button variant="outline" className="w-full" onClick={() => setConfirm('reboot')}>
          <RotateCcw className="h-4 w-4" />
          Neustart
        </Button>
        <Button
          variant="outline"
          className="w-full text-danger"
          onClick={() => setConfirm('shutdown')}
        >
          <Power className="h-4 w-4" />
          Herunterfahren
        </Button>
      </div>

      {active && (
        <ConfirmSheet
          open={confirm !== null}
          onClose={() => setConfirm(null)}
          onConfirm={run}
          title={active.title}
          description={active.description}
          confirmLabel={active.confirmLabel}
          danger={active.danger}
          loading={busy}
        />
      )}
    </CollapsibleCard>
  )
}

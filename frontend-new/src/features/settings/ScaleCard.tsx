import { useEffect, useState } from 'react'
import { Scale, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { api, ApiError } from '@/lib/api'
import { formatGrams } from '@/lib/format'
import { useSensor } from '@/stores/socketStore'

const REF_MIN_G = 1
const REF_MAX_G = 5000

/** Waage: Live-Gewicht, Tarieren und geführte Kalibrierung. */
export function ScaleCard() {
  const sensor = useSensor()
  const [taring, setTaring] = useState(false)
  const [calOpen, setCalOpen] = useState(false)

  const tare = async () => {
    setTaring(true)
    try {
      const res = await api.tare()
      if (res.success) {
        toast.success(res.message || 'Waage tariert')
      } else {
        toast.error(res.message || 'Tarieren fehlgeschlagen')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Tarieren fehlgeschlagen')
    } finally {
      setTaring(false)
    }
  }

  return (
    <CollapsibleCard title="Waage" icon={<Scale className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Aktuelles Gewicht</span>
          <span className="tnum text-lg font-semibold">{formatGrams(sensor?.weight ?? null)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={tare} loading={taring}>
            Tarieren
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setCalOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Kalibrieren
          </Button>
        </div>
      </div>

      <CalibrationSheet open={calOpen} onClose={() => setCalOpen(false)} />
    </CollapsibleCard>
  )
}

/** Geführte Kalibrierung: 1. Napf leeren + tarieren, 2. Referenzgewicht auflegen. */
function CalibrationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sensor = useSensor()
  const [step, setStep] = useState<1 | 2>(1)
  const [refWeight, setRefWeight] = useState('100')
  const [busy, setBusy] = useState(false)

  // Beim Öffnen immer bei Schritt 1 beginnen
  useEffect(() => {
    if (open) {
      setStep(1)
      setRefWeight('100')
    }
  }, [open])

  const parsed = Number.parseFloat(refWeight)
  const refValid = Number.isFinite(parsed) && parsed >= REF_MIN_G && parsed <= REF_MAX_G

  const tareAndNext = async () => {
    setBusy(true)
    try {
      const res = await api.tare()
      if (res.success) {
        toast.success(res.message || 'Waage tariert')
        setStep(2)
      } else {
        toast.error(res.message || 'Tarieren fehlgeschlagen')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Tarieren fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const calibrate = async () => {
    if (!refValid) return
    setBusy(true)
    try {
      const res = await api.calibrateWeight(parsed)
      if (res.success) {
        toast.success(res.message || 'Waage kalibriert')
        onClose()
      } else {
        toast.error(res.message || 'Kalibrierung fehlgeschlagen')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Kalibrierung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Waage kalibrieren">
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Schritt {step} von 2
        </p>

        <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
          <Scale className="h-4 w-4" />
          Aktuelles Gewicht:
          <span className="tnum ml-auto font-medium text-foreground">
            {formatGrams(sensor?.weight ?? null)}
          </span>
        </div>

        {step === 1 ? (
          <>
            <div>
              <p className="text-sm font-medium">Napf leeren</p>
              <p className="pt-1 text-sm text-muted-foreground">
                Entferne alles Futter aus dem Napf. Anschliessend wird die Waage auf null gesetzt.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={tareAndNext} loading={busy}>
              Tarieren &amp; weiter
            </Button>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium">Referenzgewicht auflegen</p>
              <p className="pt-1 text-sm text-muted-foreground">
                Lege ein bekanntes Gewicht (z. B. 100 g) in den Napf und gib dessen Gewicht ein.
              </p>
            </div>
            <Input
              label="Referenzgewicht"
              type="number"
              inputMode="decimal"
              min={REF_MIN_G}
              max={REF_MAX_G}
              suffix="g"
              value={refWeight}
              onChange={(e) => setRefWeight(e.target.value)}
              hint={`Zulässig: ${REF_MIN_G}–${REF_MAX_G} g`}
            />
            <Button size="lg" className="w-full" onClick={calibrate} loading={busy} disabled={!refValid}>
              Kalibrieren
            </Button>
          </>
        )}
      </div>
    </Sheet>
  )
}

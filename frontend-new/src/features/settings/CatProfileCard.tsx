import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cat } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl, Skeleton } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { gramsForCat, recommendedGramsPerDay } from '@/lib/calories'
import { queryClient } from '@/App'
import type { CatProfile, CatProfiles } from '@/types/api'

type Activity = CatProfile['activity']

interface CatForm {
  name: string
  weight: string
  age: string
  activity: Activity
  budget: string
  min: string
}

const DEFAULT_CATS: CatForm[] = [
  { name: 'Katze 1', weight: '', age: '', activity: 'normal', budget: '', min: '' },
  { name: 'Katze 2', weight: '', age: '', activity: 'normal', budget: '', min: '' },
]

/** Eingabestring -> Zahl (Dezimalkomma erlaubt); leer/ungültig = null. */
function parseNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function toProfile(form: CatForm): CatProfile {
  return {
    name: form.name.trim() || 'Katze',
    weight_kg: parseNumber(form.weight),
    age_years: parseNumber(form.age),
    activity: form.activity,
    budget_g: parseNumber(form.budget),
    min_g: parseNumber(form.min),
  }
}

/** Katzenprofile (2 Katzen, gemeinsames Futter) + empfohlene Tagesmenge gesamt. */
export function CatProfileCard() {
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })

  const [cats, setCats] = useState<CatForm[]>(DEFAULT_CATS)
  const [kcal, setKcal] = useState('')
  const [saving, setSaving] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && settings.data) {
      initialized.current = true
      const stored = settings.data.cat_profiles
      if (stored?.cats?.length) {
        setCats(
          stored.cats.slice(0, 2).map((cat, index) => ({
            name: cat.name || `Katze ${index + 1}`,
            weight: cat.weight_kg !== null ? String(cat.weight_kg) : '',
            age: cat.age_years !== null ? String(cat.age_years) : '',
            activity: cat.activity ?? 'normal',
            budget: cat.budget_g != null ? String(cat.budget_g) : '',
            min: cat.min_g != null ? String(cat.min_g) : '',
          })),
        )
        setKcal(stored.kcal_per_100g !== null ? String(stored.kcal_per_100g) : '')
      }
    }
  }, [settings.data])

  const updateCat = (index: number, patch: Partial<CatForm>) => {
    setCats((prev) => prev.map((cat, i) => (i === index ? { ...cat, ...patch } : cat)))
  }

  const profiles: CatProfiles = {
    kcal_per_100g: parseNumber(kcal),
    cats: cats.map(toProfile),
  }
  const total = recommendedGramsPerDay(profiles)

  const save = async () => {
    setSaving(true)
    try {
      await api.setAppSettings({ cat_profiles: profiles })
      toast.success('Katzenprofile gespeichert')
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleCard title="Katzenprofile" icon={<Cat className="h-4 w-4" />}>
      <div className="space-y-4 pt-1">
        {settings.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            {cats.map((cat, index) => {
              const grams = gramsForCat(toProfile(cat), parseNumber(kcal))
              return (
                <div key={index} className="space-y-3 rounded-md border border-border p-3">
                  <Input
                    label={`Name Katze ${index + 1}`}
                    value={cat.name}
                    maxLength={30}
                    onChange={(e) => updateCat(index, { name: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    {/* Explizite IDs: beide Katzen haben "Gewicht"/"Alter"-Felder -
                        aus dem Label generierte IDs kollidieren sonst und ein Tipp
                        aufs Label der zweiten Katze fokussiert das Feld der ersten */}
                    <Input
                      id={`cat-${index}-weight`}
                      label="Gewicht"
                      type="number"
                      min={0.5}
                      max={20}
                      step={0.1}
                      suffix="kg"
                      className="tnum"
                      value={cat.weight}
                      onChange={(e) => updateCat(index, { weight: e.target.value })}
                    />
                    <Input
                      id={`cat-${index}-age`}
                      label="Alter"
                      type="number"
                      min={0}
                      max={30}
                      suffix="Jahre"
                      className="tnum"
                      value={cat.age}
                      onChange={(e) => updateCat(index, { age: e.target.value })}
                    />
                  </div>
                  {/* Pro-Katze-Konto für die Just-in-Time-Fütterung */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id={`cat-${index}-budget`}
                      label="Tagesbudget"
                      type="number"
                      min={5}
                      max={150}
                      suffix="g"
                      className="tnum"
                      placeholder="unbegrenzt"
                      value={cat.budget}
                      onChange={(e) => updateCat(index, { budget: e.target.value })}
                    />
                    <Input
                      id={`cat-${index}-min`}
                      label="Mindestmenge"
                      type="number"
                      min={0}
                      max={100}
                      suffix="g"
                      className="tnum"
                      placeholder="0"
                      value={cat.min}
                      onChange={(e) => updateCat(index, { min: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fürs Just-in-Time-Füttern: Unter der Mindestmenge wird diese Katze
                    NIE gesperrt, auch wenn das Tagesbudget erreicht ist - setze sie
                    darum bewusst (z. B. 15 g). Ohne Budget wird nie gesperrt.
                  </p>
                  <SegmentedControl<Activity>
                    options={[
                      { value: 'ruhig', label: 'Ruhig' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'aktiv', label: 'Aktiv' },
                    ]}
                    value={cat.activity}
                    onChange={(value) => updateCat(index, { activity: value })}
                  />
                  {grams !== null && (
                    <p className="tnum text-sm text-muted-foreground">
                      {cat.name.trim() || `Katze ${index + 1}`}: ~{grams} g/Tag
                    </p>
                  )}
                </div>
              )
            })}

            <Input
              label="Futter-Energie (gemeinsames Futter)"
              type="number"
              min={50}
              max={700}
              suffix="kcal/100 g"
              className="tnum"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />

            {total !== null && (
              <div className="rounded-md bg-surface-2 p-3">
                <p className="tnum font-semibold text-primary">
                  Empfohlen gesamt: ~{total} g/Tag
                </p>
                <p className="pt-1 text-xs text-muted-foreground">
                  Beide Katzen fressen aus demselben Automaten – der Plan nutzt die Summe.
                  Richtwert – besprich die Mengen mit deinem Tierarzt.
                </p>
              </div>
            )}

            <Button className="w-full" onClick={save} loading={saving}>
              Speichern
            </Button>
          </>
        )}
      </div>
    </CollapsibleCard>
  )
}

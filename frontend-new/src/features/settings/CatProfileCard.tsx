import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cat } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl, Skeleton } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { recommendedGramsPerDay } from '@/lib/calories'
import { queryClient } from '@/App'
import type { CatProfile } from '@/types/api'

type Activity = CatProfile['activity']

/** Fallback, falls das Backend (noch) kein cat_profile liefert. */
const DEFAULT_PROFILE: CatProfile = {
  weight_kg: null,
  age_years: null,
  activity: 'normal',
  kcal_per_100g: null,
}

/** Eingabestring -> Zahl (Dezimalkomma erlaubt); leer/ungültig = null. */
function parseNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/** Katzenprofil: Gewicht, Alter, Aktivität, Futter-Energie + empfohlene Tagesmenge. */
export function CatProfileCard() {
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })

  const [weight, setWeight] = useState('')
  const [age, setAge] = useState('')
  const [activity, setActivity] = useState<Activity>('normal')
  const [kcal, setKcal] = useState('')
  const [saving, setSaving] = useState(false)
  // Nur EINMAL aus der Query initialisieren - Refetches dürfen Eingaben nicht überschreiben.
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && settings.data) {
      initialized.current = true
      const profile = settings.data.cat_profile ?? DEFAULT_PROFILE
      setWeight(profile.weight_kg !== null ? String(profile.weight_kg) : '')
      setAge(profile.age_years !== null ? String(profile.age_years) : '')
      setActivity(profile.activity)
      setKcal(profile.kcal_per_100g !== null ? String(profile.kcal_per_100g) : '')
    }
  }, [settings.data])

  const profile: CatProfile = {
    weight_kg: parseNumber(weight),
    age_years: parseNumber(age),
    activity,
    kcal_per_100g: parseNumber(kcal),
  }
  const grams = recommendedGramsPerDay(profile)

  const saved = settings.data?.cat_profile ?? DEFAULT_PROFILE
  const changed = settings.data
    ? profile.weight_kg !== saved.weight_kg ||
      profile.age_years !== saved.age_years ||
      profile.activity !== saved.activity ||
      profile.kcal_per_100g !== saved.kcal_per_100g
    : false

  const save = async () => {
    setSaving(true)
    try {
      await api.setAppSettings({ cat_profile: profile })
      toast.success('Katzenprofil gespeichert')
      queryClient.invalidateQueries({ queryKey: ['app-settings'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Katzenprofil" icon={<Cat className="h-4 w-4" />} />
      <CardContent className="space-y-3">
        {settings.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Gewicht"
                type="number"
                min={0.5}
                max={20}
                step={0.1}
                suffix="kg"
                className="tnum"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <Input
                label="Alter"
                type="number"
                min={0}
                max={30}
                suffix="Jahre"
                className="tnum"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div>
              <p className="pb-2 text-sm font-medium">Aktivität</p>
              <SegmentedControl<Activity>
                options={[
                  { value: 'ruhig', label: 'Ruhig' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'aktiv', label: 'Aktiv' },
                ]}
                value={activity}
                onChange={setActivity}
              />
            </div>
            <Input
              label="Futter-Energie"
              type="number"
              min={50}
              max={700}
              suffix="kcal/100 g"
              className="tnum"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />

            {grams !== null && (
              <div className="rounded-md bg-surface-2 p-3">
                <p className="tnum font-semibold text-primary">Empfohlen: ~{grams} g/Tag</p>
                <p className="pt-1 text-xs text-muted-foreground">
                  Richtwert – besprich die Menge mit deinem Tierarzt.
                </p>
              </div>
            )}

            <Button className="w-full" onClick={save} disabled={!changed} loading={saving}>
              Speichern
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

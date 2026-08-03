import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cat, PawPrint } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { formatGrams } from '@/lib/format'
import { queryClient } from '@/App'
import type { EatingEpisode } from '@/types/api'
import { cn } from '@/lib/utils'

/** ISO-String -> "DD.MM. HH:MM" */
function formatEpisodeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '–'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Fress-Episoden mit Katzen-Zuordnung: die Waage erkennt einzelne Mahlzeiten;
 * der Nutzer labelt sie ("das war Ayla"), ab genug Labels ordnet der
 * Klassifikator neue Episoden automatisch zu.
 */
export function EatingCard() {
  const data = useQuery({
    queryKey: ['eating-data'],
    queryFn: () => api.getEatingData(7),
    refetchInterval: 60_000,
  })
  const settings = useQuery({ queryKey: ['app-settings'], queryFn: api.getAppSettings })
  const [savingId, setSavingId] = useState<string | null>(null)

  const catNames = (settings.data?.cat_profiles?.cats ?? [])
    .map((cat) => cat.name)
    .filter(Boolean)
  const episodes = data.data?.episodes.slice(0, 8) ?? []
  const classifier = data.data?.classifier
  const perCat = data.data?.per_cat_today ?? {}
  const perCatEntries = Object.entries(perCat).filter(([name]) => name !== 'unbekannt')

  const setLabel = async (episode: EatingEpisode, label: string | null) => {
    // Erneutes Tippen auf das aktive Label hebt die Zuordnung wieder auf
    const next = episode.label === label ? null : label
    setSavingId(episode.id)
    try {
      await api.labelEpisode(episode.id, next)
      queryClient.invalidateQueries({ queryKey: ['eating-data'] })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Zuordnung fehlgeschlagen')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <CollapsibleCard title="Wer hat gefressen?" icon={<Cat className="h-4 w-4" />}>
      <div className="space-y-3 pt-1">
        {data.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : episodes.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="Noch keine Fress-Episoden"
            description="Die Waage sammelt automatisch, sobald eine Katze frisst."
          />
        ) : (
          <>
            {/* Lernstand des Klassifikators */}
            {classifier &&
              (classifier.active ? (
                <div className="rounded-md bg-success-soft p-3 text-sm text-success">
                  Erkennung aktiv - neue Episoden werden automatisch zugeordnet.
                  Zuordnungen lassen sich weiterhin korrigieren.
                </div>
              ) : (
                <div className="rounded-md bg-info-soft p-3 text-sm text-info">
                  <p className="font-medium">Lernphase</p>
                  <p className="tnum pt-0.5">
                    {catNames
                      .map(
                        (name) =>
                          `${name} ${Math.min(classifier.labels[name] ?? 0, classifier.needed_per_cat)}/${classifier.needed_per_cat}`,
                      )
                      .join(' · ')}{' '}
                    Episoden gelabelt - danach ordnet CatBoter automatisch zu.
                  </p>
                </div>
              ))}

            {/* Heutige Mengen je Katze (sobald Zuordnungen existieren) */}
            {perCatEntries.length > 0 && (
              <div className="space-y-1.5">
                {perCatEntries.map(([name, grams]) => (
                  <div key={name} className="flex min-h-6 items-center justify-between text-sm">
                    <span className="text-muted-foreground">{name} heute</span>
                    <span className="tnum font-medium">{formatGrams(grams)}</span>
                  </div>
                ))}
                {perCat['unbekannt'] !== undefined && (
                  <div className="flex min-h-6 items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nicht zugeordnet</span>
                    <span className="tnum font-medium">{formatGrams(perCat['unbekannt'])}</span>
                  </div>
                )}
              </div>
            )}

            <ul className="divide-y divide-border border-t border-border">
              {episodes.map((episode) => {
                const effective = episode.label ?? episode.auto_label
                return (
                  <li key={episode.id} className="space-y-2 py-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="tnum text-muted-foreground">
                        {formatEpisodeTime(episode.ts)}
                      </span>
                      <span className="tnum font-medium">
                        {formatGrams(episode.consumed)} · {Math.max(1, Math.round(episode.duration_s / 60))} min
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {catNames.map((name) => {
                        const isUserLabel = episode.label === name
                        const isAutoOnly = !episode.label && episode.auto_label === name
                        return (
                          <button
                            key={name}
                            onClick={() => setLabel(episode, name)}
                            disabled={savingId === episode.id}
                            className={cn(
                              'min-h-9 rounded-full border px-3 text-sm font-medium transition-colors',
                              isUserLabel
                                ? 'border-primary bg-primary-soft text-primary'
                                : isAutoOnly
                                  ? 'border-dashed border-primary/60 text-primary'
                                  : 'border-border bg-surface text-muted-foreground hover:bg-surface-2',
                            )}
                          >
                            {name}
                            {isAutoOnly && episode.confidence !== null && (
                              <span className="tnum font-normal">
                                {' '}~{Math.round(episode.confidence * 100)} %
                              </span>
                            )}
                          </button>
                        )
                      })}
                      {!effective && (
                        <span className="text-xs text-muted-foreground">Wer war das?</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <p className="text-xs text-muted-foreground">
              Gestrichelt = automatische Vermutung. Tippe die richtige Katze an, um sie zu
              bestätigen oder zu korrigieren. Sehr kurze Episoden (ein einzelner Happen)
              zählen für die Tagesmenge, aber nicht für die Lernphase - am meisten lernt
              die Erkennung aus richtigen Mahlzeiten.
            </p>
          </>
        )}
      </div>
    </CollapsibleCard>
  )
}

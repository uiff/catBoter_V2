/** Pläne-Screen: Liste aller Fütterungspläne, Aktivieren/Bearbeiten/Löschen, Editor-Sheet. */
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarClock, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { api, ApiError } from '@/lib/api'
import { queryClient } from '@/App'
import { onPlansUpdated } from '@/stores/socketStore'
import { PlanCard, type PlanItem } from './PlanCard'
import { PlanEditorSheet } from './PlanEditorSheet'

export default function PlansPage() {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<PlanItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlanItem | null>(null)

  const autoQuery = useQuery({ queryKey: ['plans', 'auto'], queryFn: api.getAutoPlans })
  const randomQuery = useQuery({ queryKey: ['plans', 'random'], queryFn: api.getRandomPlans })

  // Plan-Änderungen anderer Geräte/Tabs live übernehmen
  useEffect(
    () =>
      onPlansUpdated(() => {
        queryClient.invalidateQueries({ queryKey: ['plans'] })
        queryClient.invalidateQueries({ queryKey: ['today'] })
      }),
    [],
  )

  const loading = autoQuery.isLoading || randomQuery.isLoading

  // Zufällig generierte Tages-Pläne sind interne Artefakte und werden nicht angezeigt.
  const items: PlanItem[] = [
    ...(autoQuery.data ?? [])
      .filter((plan) => plan.isRandomGenerated !== true)
      .map((plan) => ({ kind: 'auto' as const, plan })),
    ...(randomQuery.data ?? []).map((plan) => ({ kind: 'random' as const, plan })),
  ]
  const activeItems = items.filter((item) => item.plan.active)
  const otherItems = items.filter((item) => !item.plan.active)
  const loadError =
    !loading && items.length === 0 && (autoQuery.isError || randomQuery.isError)

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: ['plans'] })
    queryClient.invalidateQueries({ queryKey: ['today'] })
  }

  const activate = useMutation({
    mutationFn: (item: PlanItem) =>
      item.kind === 'auto'
        ? api.activateAutoPlan(item.plan.planName)
        : api.activateRandomPlan(item.plan.planName),
    onSuccess: (_data, item) => {
      toast.success(`"${item.plan.planName}" aktiviert`)
      invalidatePlans()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Aktivierung fehlgeschlagen'),
  })

  const removePlan = useMutation({
    mutationFn: (item: PlanItem) =>
      item.kind === 'auto'
        ? api.deleteAutoPlan(item.plan.planName)
        : api.deleteRandomPlan(item.plan.planName),
    onSuccess: () => {
      toast.success('Plan gelöscht')
      setDeleteTarget(null)
      invalidatePlans()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Löschen fehlgeschlagen'),
  })

  const regenerate = useMutation({
    mutationFn: () => api.regenerateRandomTimes(),
    onSuccess: () => {
      toast.success('Neue Fütterungszeiten erstellt')
      invalidatePlans()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Würfeln fehlgeschlagen'),
  })

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const isSame = (a: PlanItem | undefined, b: PlanItem) =>
    !!a && a.kind === b.kind && a.plan.planName === b.plan.planName

  const renderCard = (item: PlanItem) => (
    <PlanCard
      key={`${item.kind}:${item.plan.planName}`}
      item={item}
      onActivate={() => activate.mutate(item)}
      onEdit={() => {
        setEditing(item)
        setEditorOpen(true)
      }}
      onDelete={() => setDeleteTarget(item)}
      onRegenerate={
        item.kind === 'random' && item.plan.active ? () => regenerate.mutate() : undefined
      }
      activating={activate.isPending && isSame(activate.variables, item)}
      regenerating={regenerate.isPending && item.kind === 'random' && item.plan.active}
    />
  )

  return (
    <div className="space-y-3">
      {/* Titelzeile */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Fütterungspläne</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Neu
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : loadError ? (
        <Card>
          <CardContent>
            <p className="text-sm text-danger">Pläne konnten nicht geladen werden.</p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={CalendarClock}
              title="Noch kein Plan"
              description="Lege feste Fütterungszeiten fest oder lass den Zufall entscheiden."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Ersten Plan erstellen
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Aktiver Plan zuerst, hervorgehoben und in voller Breite */}
          {activeItems.map(renderCard)}
          {otherItems.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">{otherItems.map(renderCard)}</div>
          )}
        </>
      )}

      <PlanEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} editing={editing} />

      <ConfirmSheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removePlan.mutate(deleteTarget)}
        title="Plan löschen?"
        description={
          deleteTarget ? `"${deleteTarget.plan.planName}" wird dauerhaft gelöscht.` : undefined
        }
        confirmLabel="Löschen"
        danger
        loading={removePlan.isPending}
      />
    </div>
  )
}

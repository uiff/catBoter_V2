import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { config } from '@/lib/config'
import type { AutoPlan, RandomPlan, ManualFeedRequest } from '@/types/feeding'

export function useFeedingPlans() {
  const [autoPlans, setAutoPlans] = useState<AutoPlan[]>([])
  const [randomPlans, setRandomPlans] = useState<RandomPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${config.apiBaseUrl}/feeding_plan`)
      const plans = await res.json()

      // Separate auto plans (have feedingSchedule) from random plans (have startTime/endTime)
      const autoPlansList = plans.filter((p: any) => 'feedingSchedule' in p)
      const randomPlansList = plans.filter((p: any) => 'startTime' in p && 'endTime' in p)

      setAutoPlans(autoPlansList)
      setRandomPlans(randomPlansList)
      setError(null)
    } catch (err) {
      setError('Fehler beim Laden der Pläne')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const manualFeed = useCallback(async (request: ManualFeedRequest) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/motor/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: request.weight, timeout: 120 }),
      })
      if (!res.ok) throw new Error('Manual feed failed')
      const data = await res.json()
      if (data.success) {
        toast.success('Fütterung gestartet!', {
          description: `${request.weight}g werden ausgegeben`,
          duration: 2000  // 2 Sekunden statt Standard (4s)
        })
        return true
      }
      toast.error('Fütterung fehlgeschlagen')
      return false
    } catch (err) {
      console.error(err)
      toast.error('Verbindungsfehler', {
        description: 'Konnte Fütterung nicht starten'
      })
      return false
    }
  }, [])

  const stopMotor = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/motor/stop`, {
        method: 'POST',
      })
      if (res.ok) {
        toast.success('Motor gestoppt!', {
          description: 'Motor wurde erfolgreich gestoppt'
        })
        return true
      }
      toast.error('Stopp fehlgeschlagen')
      return false
    } catch (err) {
      console.error(err)
      toast.error('Verbindungsfehler', {
        description: 'Konnte Motor nicht stoppen'
      })
      return false
    }
  }, [])

  const createAutoPlan = useCallback(async (plan: Omit<AutoPlan, 'active'>) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/feeding_plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, active: false }),
      })
      if (res.ok) {
        await fetchPlans()
        toast.success('Automatischer Plan erstellt!', {
          description: `"${plan.planName}" wurde erfolgreich angelegt - klicke auf ▶️ zum Aktivieren`
        })
        return true
      }
      toast.error('Plan konnte nicht erstellt werden')
      return false
    } catch (err) {
      console.error(err)
      toast.error('Verbindungsfehler', {
        description: 'Konnte Plan nicht speichern'
      })
      return false
    }
  }, [fetchPlans])

  const createRandomPlan = useCallback(async (plan: Omit<RandomPlan, 'active'>) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/feeding_plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, active: false }),
      })
      if (res.ok) {
        await fetchPlans()
        toast.success('Zufälliger Plan erstellt!', {
          description: `"${plan.planName}" wurde erfolgreich angelegt - klicke auf ▶️ zum Aktivieren`
        })
        return true
      }
      toast.error('Plan konnte nicht erstellt werden')
      return false
    } catch (err) {
      console.error(err)
      toast.error('Verbindungsfehler', {
        description: 'Konnte Plan nicht speichern'
      })
      return false
    }
  }, [fetchPlans])

  const deletePlan = useCallback(async (planName: string, _type: 'auto' | 'random') => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/feeding_plan/${planName}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchPlans()
        toast.success('Plan gelöscht', {
          description: `"${planName}" wurde erfolgreich entfernt`
        })
        return true
      }
      toast.error('Plan konnte nicht gelöscht werden')
      return false
    } catch (err) {
      console.error(err)
      toast.error('Verbindungsfehler', {
        description: 'Konnte Plan nicht löschen'
      })
      return false
    }
  }, [fetchPlans])

  const togglePlanActive = useCallback(async (planName: string, currentActive: boolean) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/feeding_plan/${planName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      })
      if (res.ok) {
        await fetchPlans()
        const newStatus = !currentActive ? 'aktiviert' : 'deaktiviert'
        toast.success(`Plan ${newStatus}`, {
          description: `"${planName}" wurde ${newStatus}`
        })
        return true
      }
      toast.error('Status konnte nicht geändert werden')
      return false
    } catch (err) {
      console.error(err)
      toast.error('Verbindungsfehler', {
        description: 'Konnte Status nicht ändern'
      })
      return false
    }
  }, [fetchPlans])

  const updatePlan = useCallback(async (planName: string, updatedPlan: Partial<AutoPlan | RandomPlan>) => {
    try {
      // Backend unterstützt kein PATCH/PUT, daher löschen wir den alten Plan und erstellen einen neuen

      // Prüfe ob der Plan aktuell aktiv ist
      const allPlans = [...autoPlans, ...randomPlans]
      const oldPlan = allPlans.find(p => p.planName === planName)
      const wasActive = oldPlan?.active || false
      const planType = 'feedingSchedule' in updatedPlan ? 'auto' : 'random'

      // Zuerst: alten Plan löschen
      const deleteRes = await fetch(`${config.apiBaseUrl}/feeding_plan/${planName}`, {
        method: 'DELETE',
      })

      if (!deleteRes.ok) {
        toast.error('Plan konnte nicht aktualisiert werden')
        return false
      }

      // Dann: neuen Plan mit gleichen Daten erstellen
      const createRes = await fetch(`${config.apiBaseUrl}/feeding_plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPlan),
      })

      if (!createRes.ok) {
        toast.error('Plan konnte nicht aktualisiert werden')
        return false
      }

      // Wenn Plan vorher aktiv war, wieder aktivieren
      if (wasActive) {
        const endpoint = planType === 'auto'
          ? `${config.apiBaseUrl}/feeding_plan/load`
          : `${config.apiBaseUrl}/random_plan/activate`

        const activateRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_name: updatedPlan.planName }),
        })

        if (!activateRes.ok) {
          toast.warning('Plan aktualisiert, aber konnte nicht aktiviert werden', {
            description: 'Bitte aktiviere den Plan manuell'
          })
        } else {
          // Warte kurz damit Backend den Status aktualisieren kann
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      await fetchPlans()
      toast.success('Plan aktualisiert', {
        description: `"${planName}" wurde erfolgreich geändert${wasActive ? ' und ist weiterhin aktiv' : ''}`
      })
      return true
    } catch (err) {
      console.error(err)
      toast.error('Verbindungsfehler', {
        description: 'Konnte Plan nicht aktualisieren'
      })
      return false
    }
  }, [fetchPlans, autoPlans, randomPlans])

  const activatePlan = useCallback(async (planName: string, type: 'auto' | 'random') => {
    try {
      const endpoint = type === 'auto'
        ? `${config.apiBaseUrl}/feeding_plan/load`
        : `${config.apiBaseUrl}/random_plan/activate`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_name: planName }),
      })

      if (res.ok) {
        await fetchPlans()
        toast.success('Plan aktiviert!', {
          description: `"${planName}" ist jetzt aktiv - alle anderen Pläne wurden deaktiviert`,
          duration: 3000
        })
        return true
      }
      toast.error('Plan konnte nicht aktiviert werden')
      return false
    } catch (err) {
      console.error(err)
      toast.error('Verbindungsfehler', {
        description: 'Konnte Plan nicht aktivieren'
      })
      return false
    }
  }, [fetchPlans])

  return {
    autoPlans,
    randomPlans,
    loading,
    error,
    fetchPlans,
    manualFeed,
    stopMotor,
    createAutoPlan,
    createRandomPlan,
    deletePlan,
    togglePlanActive,
    updatePlan,
    activatePlan,
  }
}

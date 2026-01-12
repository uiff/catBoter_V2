import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, Shuffle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

interface FeedingPlan {
  name: string
  days: string[]
  feedingSchedule: Record<string, Array<{ time: string; weight: number }>>
  active: boolean
  type: 'auto'
}

interface RandomPlan {
  name: string
  active: boolean
  days: string[]
  config: {
    start_time: string
    end_time: string
    feedings_per_day: number
    weight_per_feeding: number
    min_interval_minutes: number
  }
  type: 'random'
}

type Plan = (FeedingPlan | RandomPlan) & { type: 'auto' | 'random' }

export function PlanOverview() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)

  const fetchPlans = async () => {
    try {
      setLoading(true)

      // Fetch both auto and random plans
      const [autoRes, randomRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/feeding_plan`),
        fetch(`${config.apiBaseUrl}/random_plans`)
      ])

      const autoPlans: FeedingPlan[] = autoRes.ok ? await autoRes.json() : []
      const randomPlans: RandomPlan[] = randomRes.ok ? await randomRes.json() : []

      // Combine and mark types
      const allPlans: Plan[] = [
        ...autoPlans.map(p => ({ ...p, type: 'auto' as const })),
        ...randomPlans.map(p => ({ ...p, type: 'random' as const }))
      ]

      setPlans(allPlans)
    } catch (error) {
      console.error('Error fetching plans:', error)
      toast.error('Fehler beim Laden der Pläne')
    } finally {
      setLoading(false)
    }
  }

  const activatePlan = async (planName: string, planType: 'auto' | 'random') => {
    try {
      setActivating(planName)

      const endpoint = planType === 'auto'
        ? `${config.apiBaseUrl}/feeding_plan/load`
        : `${config.apiBaseUrl}/random_plan/activate`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_name: planName })
      })

      if (response.ok) {
        toast.success(`Plan "${planName}" aktiviert`)
        fetchPlans()
      } else {
        toast.error('Fehler beim Aktivieren')
      }
    } catch (error) {
      console.error('Error activating plan:', error)
      toast.error('Verbindungsfehler')
    } finally {
      setActivating(null)
    }
  }

  useEffect(() => {
    fetchPlans()

    // Refresh every 30 seconds
    const interval = setInterval(fetchPlans, 30000)
    return () => clearInterval(interval)
  }, [])

  const getPlanStats = (plan: Plan) => {
    if (plan.type === 'auto') {
      const schedule = plan.feedingSchedule || {}
      const allFeedings = Object.values(schedule).flat()
      const totalFeedings = allFeedings.length
      const avgWeight = totalFeedings > 0
        ? allFeedings.reduce((sum, f) => sum + f.weight, 0) / totalFeedings
        : 0

      // Berechne Fütterungen pro Tag (nicht total für die Woche)
      const activeDays = plan.days?.length || 1
      const feedingsPerDay = activeDays > 0 ? totalFeedings / activeDays : 0

      return {
        feedings: Math.round(feedingsPerDay * 10) / 10, // Auf 1 Dezimalstelle runden
        avgWeight: avgWeight.toFixed(1),
        days: activeDays
      }
    } else {
      return {
        feedings: plan.config?.feedings_per_day || 0,
        avgWeight: (plan.config?.weight_per_feeding || 0).toFixed(1),
        days: plan.days?.length || 0
      }
    }
  }

  if (loading) {
    return (
      <div className="glass rounded-xl p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-muted-foreground">Keine Fütterungspläne vorhanden</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Fütterungspläne</h2>
        <span className="text-sm text-muted-foreground">
          {plans.length} Plan{plans.length !== 1 ? 'e' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan, index) => {
          const stats = getPlanStats(plan)
          const isActive = plan.active
          const isActivating = activating === plan.name

          return (
            <motion.div
              key={`${plan.type}-${plan.name}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`glass rounded-xl p-6 border-2 transition-all ${
                isActive
                  ? 'border-green-500 bg-green-500/5'
                  : 'border-transparent hover:border-border'
              }`}
            >
              {/* Header with Type Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg truncate mb-1">{plan.name}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      plan.type === 'auto'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    }`}
                  >
                    {plan.type === 'auto' ? (
                      <>
                        <Clock className="w-3 h-3" />
                        Automatisch
                      </>
                    ) : (
                      <>
                        <Shuffle className="w-3 h-3" />
                        Zufällig
                      </>
                    )}
                  </span>
                </div>
                {isActive && (
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                )}
              </div>

              {/* Stats */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fütterungen/Tag:</span>
                  <span className="font-medium">{stats.feedings}x</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ø Menge:</span>
                  <span className="font-medium">{stats.avgWeight}g</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Aktive Tage:</span>
                  <span className="font-medium">{stats.days}</span>
                </div>

                {plan.type === 'random' && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Zeitfenster:</span>
                      <span className="font-medium text-xs">
                        {plan.config.start_time} - {plan.config.end_time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Min. Abstand:</span>
                      <span className="font-medium">{plan.config.min_interval_minutes}min</span>
                    </div>
                  </>
                )}
              </div>

              {/* Days */}
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, i) => {
                    const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
                    const isActive = plan.days?.includes(dayNames[i]) || false

                    return (
                      <span
                        key={day}
                        className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background/50 text-muted-foreground'
                        }`}
                      >
                        {day}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Activate Button */}
              {!isActive && (
                <button
                  onClick={() => activatePlan(plan.name, plan.type)}
                  disabled={isActivating}
                  className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Aktiviere...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Aktivieren
                    </>
                  )}
                </button>
              )}

              {isActive && (
                <div className="w-full py-2 px-4 bg-green-500/20 text-green-500 font-medium rounded-lg text-center border border-green-500/30">
                  Aktiv
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Clock, Shuffle, Trash2, X, Save, Edit, Play, CheckCircle2, Loader2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFeedingPlans } from '@/hooks/useFeedingPlans'
import { toast } from 'sonner'

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

type Plan = {
  name: string
  type: 'auto' | 'random'
  active: boolean
  days: string[]
  // Auto plan specific
  feedingSchedule?: Record<string, Array<{ time: string; weight: number }>>
  dailyWeight?: number
  // Random plan specific
  startTime?: string
  endTime?: string
  feedingsPerDay?: number
  weightPerFeeding?: number
  minIntervalMinutes?: number
}

export function FeedControl() {
  const [showPlanTypeSelector, setShowPlanTypeSelector] = useState(false)
  const [showAutoPlanForm, setShowAutoPlanForm] = useState(false)
  const [showRandomPlanForm, setShowRandomPlanForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [allPlans, setAllPlans] = useState<Plan[]>([])
  const [activatingPlan, setActivatingPlan] = useState<string | null>(null)

  const { autoPlans, randomPlans, fetchPlans, createAutoPlan, createRandomPlan, deletePlan, updatePlan } = useFeedingPlans()

  // Auto Plan Form State
  const [autoPlanName, setAutoPlanName] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>(WEEKDAYS)
  const [dailyWeight, setDailyWeight] = useState('60')
  const [feedingsPerDay, setFeedingsPerDay] = useState(4)
  const [feedingTimes, setFeedingTimes] = useState<string[]>(['07:00', '11:00', '15:00', '19:00'])

  // Random Plan Form State
  const [randomPlanName, setRandomPlanName] = useState('')
  const [randomSelectedDays, setRandomSelectedDays] = useState<string[]>(WEEKDAYS)
  const [startTime, setStartTime] = useState('06:00')
  const [endTime, setEndTime] = useState('22:00')
  const [randomFeedingsPerDay, setRandomFeedingsPerDay] = useState(4)
  const [weightPerFeeding, setWeightPerFeeding] = useState('15')
  const [minInterval, setMinInterval] = useState('60')

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  // Combine auto and random plans into one list
  useEffect(() => {
    const combined: Plan[] = [
      ...autoPlans.map(p => ({
        name: p.planName,
        type: 'auto' as const,
        active: p.active,
        days: p.selectedDays,
        feedingSchedule: p.feedingSchedule,
        dailyWeight: p.dailyWeight
      })),
      ...randomPlans.map(p => ({
        name: p.planName,
        type: 'random' as const,
        active: p.active,
        days: p.selectedDays || [],
        startTime: p.timeRanges[0]?.start || '06:00',
        endTime: p.timeRanges[0]?.end || '22:00',
        feedingsPerDay: p.maxFeedings,
        weightPerFeeding: p.maxAmount,
        minIntervalMinutes: undefined
      }))
    ]
    setAllPlans(combined)
  }, [autoPlans, randomPlans])

  const activatePlan = async (planName: string, planType: 'auto' | 'random') => {
    try {
      setActivatingPlan(planName)

      const endpoint = planType === 'auto'
        ? `/api/feeding_plan/load`
        : `/api/random_plan/activate`

      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_name: planName })
      })

      if (response.ok) {
        toast.success(`Plan "${planName}" aktiviert`)
        await fetchPlans()
      } else {
        toast.error('Fehler beim Aktivieren')
      }
    } catch (error) {
      console.error('Error activating plan:', error)
      toast.error('Verbindungsfehler')
    } finally {
      setActivatingPlan(null)
    }
  }

  const handleNewPlanClick = () => {
    setShowPlanTypeSelector(true)
  }

  const handlePlanTypeSelect = (type: 'auto' | 'random') => {
    setShowPlanTypeSelector(false)
    if (type === 'auto') {
      setAutoPlanName('')
      setSelectedDays(WEEKDAYS)
      setDailyWeight('60')
      setFeedingsPerDay(4)
      setFeedingTimes(['07:00', '11:00', '15:00', '19:00'])
      setEditingPlan(null)
      setShowAutoPlanForm(true)
    } else {
      setRandomPlanName('')
      setRandomSelectedDays(WEEKDAYS)
      setStartTime('06:00')
      setEndTime('22:00')
      setRandomFeedingsPerDay(4)
      setWeightPerFeeding('15')
      setMinInterval('60')
      setEditingPlan(null)
      setShowRandomPlanForm(true)
    }
  }

  const toggleDay = (day: string, isRandom: boolean = false) => {
    if (isRandom) {
      setRandomSelectedDays(prev =>
        prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      )
    } else {
      setSelectedDays(prev =>
        prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      )
    }
  }

  const updateFeedingTime = (index: number, value: string) => {
    const newTimes = [...feedingTimes]
    newTimes[index] = value
    setFeedingTimes(newTimes)
  }

  const startEditingPlan = (plan: Plan) => {
    if (plan.type === 'auto') {
      const autoPlan = autoPlans.find(p => p.planName === plan.name)
      if (autoPlan) {
        setEditingPlan(plan.name)
        setAutoPlanName(plan.name)
        setSelectedDays(plan.days)
        setDailyWeight(plan.dailyWeight?.toString() || '60')

        const firstDay = plan.days[0]
        const times = plan.feedingSchedule?.[firstDay]?.map((f: any) => f.time) || []
        setFeedingTimes(times)
        setFeedingsPerDay(times.length)
        setShowAutoPlanForm(true)
      }
    } else {
      const randomPlan = randomPlans.find(p => p.planName === plan.name)
      if (randomPlan) {
        setEditingPlan(plan.name)
        setRandomPlanName(plan.name)
        setRandomSelectedDays(plan.days)
        setStartTime(plan.startTime || '06:00')
        setEndTime(plan.endTime || '22:00')
        setRandomFeedingsPerDay(plan.feedingsPerDay || 4)
        setWeightPerFeeding(plan.weightPerFeeding?.toString() || '15')
        setMinInterval(plan.minIntervalMinutes?.toString() || '60')
        setShowRandomPlanForm(true)
      }
    }
  }

  const handleSaveAutoPlan = async () => {
    const weightPerFeeding = parseFloat(dailyWeight) / feedingsPerDay

    const feedingSchedule: any = {}
    selectedDays.forEach(day => {
      feedingSchedule[day] = feedingTimes.slice(0, feedingsPerDay).map(time => ({
        time,
        weight: weightPerFeeding
      }))
    })

    const planData = {
      planName: autoPlanName,
      selectedDays,
      feedingSchedule,
      weightMode: 'daily' as const,
      dailyWeight: parseFloat(dailyWeight)
    }

    const success = editingPlan
      ? await updatePlan(editingPlan, planData)
      : await createAutoPlan(planData)

    if (success) {
      setShowAutoPlanForm(false)
      setAutoPlanName('')
      setEditingPlan(null)
    }
  }

  const handleSaveRandomPlan = async () => {
    const planData = {
      planName: randomPlanName,
      minFeedings: randomFeedingsPerDay,
      maxFeedings: randomFeedingsPerDay,
      minAmount: parseFloat(weightPerFeeding),
      maxAmount: parseFloat(weightPerFeeding),
      timeRanges: [{ start: startTime, end: endTime }],
      selectedDays: randomSelectedDays
    }

    const success = editingPlan
      ? await updatePlan(editingPlan, planData)
      : await createRandomPlan(planData)

    if (success) {
      setShowRandomPlanForm(false)
      setRandomPlanName('')
      setEditingPlan(null)
    }
  }

  const cancelEdit = () => {
    setShowAutoPlanForm(false)
    setShowRandomPlanForm(false)
    setShowPlanTypeSelector(false)
    setEditingPlan(null)
  }

  const getPlanStats = (plan: Plan) => {
    if (plan.type === 'auto') {
      const schedule = plan.feedingSchedule || {}
      const allFeedings = Object.values(schedule).flat()
      const totalFeedings = allFeedings.length
      const avgWeight = totalFeedings > 0
        ? allFeedings.reduce((sum, f) => sum + f.weight, 0) / totalFeedings
        : 0
      const activeDays = plan.days?.length || 1
      const feedingsPerDay = activeDays > 0 ? totalFeedings / activeDays : 0

      return {
        feedings: Math.round(feedingsPerDay * 10) / 10,
        avgWeight: avgWeight.toFixed(1),
        days: activeDays,
        details: allFeedings.length > 0 ? allFeedings.slice(0, 4).map(f => `${f.time} (${f.weight}g)`) : []
      }
    } else {
      return {
        feedings: plan.feedingsPerDay || 0,
        avgWeight: (plan.weightPerFeeding || 0).toFixed(1),
        days: plan.days?.length || 0,
        details: [`${plan.startTime} - ${plan.endTime}`, `Min. ${plan.minIntervalMinutes}min Abstand`]
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fütterungspläne</h1>
          <p className="text-muted-foreground mt-1">
            {allPlans.length} {allPlans.length === 1 ? 'Plan' : 'Pläne'} • {allPlans.filter(p => p.active).length} aktiv
          </p>
        </div>
        <button
          onClick={handleNewPlanClick}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl font-semibold"
        >
          <Plus className="w-5 h-5" />
          Neuer Plan
        </button>
      </div>

      {/* Plan Type Selector Modal */}
      <AnimatePresence>
        {showPlanTypeSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={cancelEdit}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-8 max-w-2xl w-full border border-border/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Plan-Typ auswählen</h2>
                <button onClick={cancelEdit} className="hover:bg-white/10 p-2 rounded-lg transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Auto Plan */}
                <button
                  onClick={() => handlePlanTypeSelect('auto')}
                  className="glass hover:bg-blue-500/10 border-2 border-transparent hover:border-blue-500/50 rounded-xl p-6 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all">
                      <Clock className="w-6 h-6 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Auto-Plan</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3">
                    Feste Fütterungszeiten jeden Tag
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Definiere genaue Zeiten (z.B. 07:00, 12:00, 18:00)</li>
                    <li>• Gleichbleibende Mengen pro Fütterung</li>
                    <li>• Ideal für regelmäßige Routinen</li>
                  </ul>
                </button>

                {/* Random Plan */}
                <button
                  onClick={() => handlePlanTypeSelect('random')}
                  className="glass hover:bg-orange-500/10 border-2 border-transparent hover:border-orange-500/50 rounded-xl p-6 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-all">
                      <Shuffle className="w-6 h-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Random-Plan</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3">
                    Zufällige Zeiten innerhalb eines Zeitfensters
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Zeitfenster definieren (z.B. 06:00 - 22:00)</li>
                    <li>• Anzahl Fütterungen pro Tag festlegen</li>
                    <li>• Verhindert Gewöhnung an feste Zeiten</li>
                  </ul>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto Plan Form */}
      <AnimatePresence>
        {showAutoPlanForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={cancelEdit}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-8 max-w-2xl w-full my-8 border border-border/50"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold">{editingPlan ? 'Auto-Plan bearbeiten' : 'Neuer Auto-Plan'}</h2>
                </div>
                <button onClick={cancelEdit} className="hover:bg-white/10 p-2 rounded-lg transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Plan-Name</label>
                  <input
                    type="text"
                    value={autoPlanName}
                    onChange={(e) => setAutoPlanName(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                    placeholder="z.B. Wochentags-Plan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tägliche Gesamtmenge (Gramm)</label>
                  <input
                    type="number"
                    value={dailyWeight}
                    onChange={(e) => setDailyWeight(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Fütterungen pro Tag ({parseFloat(dailyWeight) / feedingsPerDay}g pro Fütterung)</label>
                  <input
                    type="number"
                    value={feedingsPerDay}
                    onChange={(e) => setFeedingsPerDay(parseInt(e.target.value))}
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                    min="1"
                    max="10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Fütterungszeiten</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: feedingsPerDay }).map((_, idx) => (
                      <input
                        key={idx}
                        type="time"
                        value={feedingTimes[idx] || ''}
                        onChange={(e) => updateFeedingTime(idx, e.target.value)}
                        className="bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Aktive Tage</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={cn(
                          'px-4 py-3 rounded-lg text-sm font-medium transition-all',
                          selectedDays.includes(day)
                            ? 'bg-primary text-primary-foreground shadow-lg'
                            : 'glass hover:bg-white/10'
                        )}
                      >
                        {day.slice(0, 2)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 glass hover:bg-white/10 rounded-lg py-3 px-6 font-semibold transition-all"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSaveAutoPlan}
                    disabled={!autoPlanName || selectedDays.length === 0}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-3 px-6 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {editingPlan ? 'Aktualisieren' : 'Erstellen'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Random Plan Form */}
      <AnimatePresence>
        {showRandomPlanForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={cancelEdit}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-8 max-w-2xl w-full my-8 border border-border/50"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Shuffle className="w-5 h-5 text-orange-500" />
                  </div>
                  <h2 className="text-2xl font-bold">{editingPlan ? 'Random-Plan bearbeiten' : 'Neuer Random-Plan'}</h2>
                </div>
                <button onClick={cancelEdit} className="hover:bg-white/10 p-2 rounded-lg transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Plan-Name</label>
                  <input
                    type="text"
                    value={randomPlanName}
                    onChange={(e) => setRandomPlanName(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                    placeholder="z.B. Zufalls-Plan"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Start-Zeit</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">End-Zeit</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Fütterungen pro Tag</label>
                  <input
                    type="number"
                    value={randomFeedingsPerDay}
                    onChange={(e) => setRandomFeedingsPerDay(parseInt(e.target.value))}
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                    min="1"
                    max="10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Gramm pro Fütterung</label>
                  <input
                    type="number"
                    value={weightPerFeeding}
                    onChange={(e) => setWeightPerFeeding(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mindestabstand (Minuten)</label>
                  <input
                    type="number"
                    value={minInterval}
                    onChange={(e) => setMinInterval(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-primary"
                    min="15"
                    placeholder="z.B. 60 für 1 Stunde"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimaler Zeitabstand zwischen Fütterungen
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Aktive Tage</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day, true)}
                        className={cn(
                          'px-4 py-3 rounded-lg text-sm font-medium transition-all',
                          randomSelectedDays.includes(day)
                            ? 'bg-primary text-primary-foreground shadow-lg'
                            : 'glass hover:bg-white/10'
                        )}
                      >
                        {day.slice(0, 2)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 glass hover:bg-white/10 rounded-lg py-3 px-6 font-semibold transition-all"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSaveRandomPlan}
                    disabled={!randomPlanName || randomSelectedDays.length === 0}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-3 px-6 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {editingPlan ? 'Aktualisieren' : 'Erstellen'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plans Grid */}
      {allPlans.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-12 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Noch keine Pläne erstellt</h3>
          <p className="text-muted-foreground mb-6">
            Erstelle deinen ersten Fütterungsplan um zu starten
          </p>
          <button
            onClick={handleNewPlanClick}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg transition-all font-semibold"
          >
            <Plus className="w-5 h-5" />
            Ersten Plan erstellen
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPlans
            .sort((a, b) => {
              // Aktive Pläne zuerst
              if (a.active && !b.active) return -1
              if (!a.active && b.active) return 1
              return 0
            })
            .map((plan, index) => {
            const stats = getPlanStats(plan)
            const isActivating = activatingPlan === plan.name

            return (
              <motion.div
                key={`${plan.type}-${plan.name}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'glass rounded-xl p-6 border-2 transition-all',
                  plan.active
                    ? 'border-green-500 bg-green-500/5 shadow-lg shadow-green-500/20'
                    : 'border-transparent hover:border-border/50'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate mb-2">{plan.name}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                          plan.type === 'auto'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        )}
                      >
                        {plan.type === 'auto' ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            Auto
                          </>
                        ) : (
                          <>
                            <Shuffle className="w-3.5 h-3.5" />
                            Random
                          </>
                        )}
                      </span>
                      {plan.active && (
                        <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-500 text-xs px-2.5 py-1 rounded-full border border-green-500/30">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          Aktiv
                        </span>
                      )}
                    </div>
                  </div>
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
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-border/30">
                  {!plan.active && (
                    <button
                      onClick={() => activatePlan(plan.name, plan.type)}
                      disabled={isActivating}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 px-4 rounded-lg transition-all font-medium disabled:opacity-50"
                    >
                      {isActivating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Aktiviere...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Aktivieren
                        </>
                      )}
                    </button>
                  )}
                  {plan.active && (
                    <div className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 text-green-500 py-2.5 px-4 rounded-lg border border-green-500/30 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Läuft
                    </div>
                  )}
                  <button
                    onClick={() => startEditingPlan(plan)}
                    className="glass hover:bg-white/10 p-2.5 rounded-lg transition-all"
                    title="Bearbeiten"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePlan(plan.name, plan.type)}
                    className="glass hover:bg-destructive/20 text-destructive p-2.5 rounded-lg transition-all"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

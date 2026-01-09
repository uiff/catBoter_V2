import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, Plus, Clock, Shuffle, Trash2, X, Save, Edit, Square, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFeedingPlans } from '@/hooks/useFeedingPlans'
import { useWebSocket } from '@/hooks/useWebSocket'

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

export function FeedControl() {
  const [activeTab, setActiveTab] = useState<'manual' | 'auto' | 'random'>('manual')
  const [weight, setWeight] = useState('15')
  const [showAutoPlanForm, setShowAutoPlanForm] = useState(false)
  const [showRandomPlanForm, setShowRandomPlanForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [_editingPlanType, setEditingPlanType] = useState<'auto' | 'random' | null>(null)

  const { autoPlans, randomPlans, fetchPlans, manualFeed, stopMotor, createAutoPlan, createRandomPlan, deletePlan, updatePlan, activatePlan } = useFeedingPlans()
  const { isMotorRunning } = useWebSocket()

  // Auto Plan Form
  const [autoPlanName, setAutoPlanName] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>(WEEKDAYS)
  const [dailyWeight, setDailyWeight] = useState('60')
  const [feedingsPerDay, setFeedingsPerDay] = useState(4)
  const [feedingTimes, setFeedingTimes] = useState<string[]>(['07:00', '11:00', '15:00', '19:00'])

  // Random Plan Form
  const [randomPlanName, setRandomPlanName] = useState('')
  const [randomSelectedDays, setRandomSelectedDays] = useState<string[]>(WEEKDAYS)
  const [startTime, setStartTime] = useState('06:00')
  const [endTime, setEndTime] = useState('22:00')
  const [randomFeedingsPerDay, setRandomFeedingsPerDay] = useState(4)
  const [weightPerFeeding, setWeightPerFeeding] = useState('15')
  const [minInterval, setMinInterval] = useState('60') // Minimum interval in minutes

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const handleManualFeed = async () => {
    await manualFeed({ weight: parseFloat(weight) })
  }

  const handleStopMotor = async () => {
    await stopMotor()
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

  const startEditingAutoPlan = (plan: any) => {
    setEditingPlan(plan.planName)
    setEditingPlanType('auto')
    setAutoPlanName(plan.planName)
    setSelectedDays(plan.selectedDays)
    setDailyWeight(plan.dailyWeight?.toString() || '60')

    // Extract feeding times from the schedule
    const firstDay = plan.selectedDays[0]
    const times = plan.feedingSchedule[firstDay]?.map((f: any) => f.time) || []
    setFeedingTimes(times)
    setFeedingsPerDay(times.length)
    setShowAutoPlanForm(true)
  }

  const startEditingRandomPlan = (plan: any) => {
    setEditingPlan(plan.planName)
    setEditingPlanType('random')
    setRandomPlanName(plan.planName)
    setRandomSelectedDays(plan.selectedDays)
    setStartTime(plan.startTime)
    setEndTime(plan.endTime)
    setRandomFeedingsPerDay(plan.feedingsPerDay)
    setWeightPerFeeding(plan.weightPerFeeding?.toString() || '15')
    setMinInterval(plan.minIntervalMinutes?.toString() || '60')
    setShowRandomPlanForm(true)
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
      setEditingPlanType(null)
    }
  }

  const handleSaveRandomPlan = async () => {
    const planData = {
      planName: randomPlanName,
      startTime,
      endTime,
      feedingsPerDay: randomFeedingsPerDay,
      weightPerFeeding: parseFloat(weightPerFeeding),
      selectedDays: randomSelectedDays,
      minIntervalMinutes: parseInt(minInterval)
    }

    const success = editingPlan
      ? await updatePlan(editingPlan, planData)
      : await createRandomPlan(planData)

    if (success) {
      setShowRandomPlanForm(false)
      setRandomPlanName('')
      setEditingPlan(null)
      setEditingPlanType(null)
    }
  }

  const cancelEdit = () => {
    setShowAutoPlanForm(false)
    setShowRandomPlanForm(false)
    setEditingPlan(null)
    setEditingPlanType(null)
    setAutoPlanName('')
    setRandomPlanName('')
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="glass rounded-xl p-4 flex items-start gap-3 bg-blue-500/5 border border-blue-500/20">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-500 mb-1">Hinweis zu Fütterungsplänen</p>
          <p className="text-muted-foreground">
            Es kann immer nur <strong>EIN Plan</strong> (Auto oder Random) gleichzeitig aktiv sein.
            Beim Aktivieren eines Plans werden automatisch alle anderen Pläne deaktiviert.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass rounded-xl p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('manual')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-medium',
            activeTab === 'manual' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5'
          )}
        >
          <Play className="w-4 h-4" />
          Manuell
        </button>
        <button
          onClick={() => setActiveTab('auto')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-medium',
            activeTab === 'auto' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5'
          )}
        >
          <Clock className="w-4 h-4" />
          Auto-Pläne
        </button>
        <button
          onClick={() => setActiveTab('random')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-medium',
            activeTab === 'random' ? 'bg-primary text-primary-foreground' : 'hover:bg-white/5'
          )}
        >
          <Shuffle className="w-4 h-4" />
          Random-Pläne
        </button>
      </div>

      {/* Manual Feed */}
      {activeTab === 'manual' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold">Manuell füttern</h3>
          <div>
            <label className="block text-sm font-medium mb-2">Futtermenge (Gramm)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
              min="1"
              max="100"
            />
          </div>
          <button
            onClick={handleManualFeed}
            disabled={isMotorRunning}
            className={cn(
              'w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-4 px-6 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
              isMotorRunning && 'animate-pulse-glow'
            )}
          >
            <Play className="w-5 h-5" />
            {isMotorRunning ? `Füttert ${weight}g...` : `${weight}g füttern`}
          </button>

          {isMotorRunning && (
            <button
              onClick={handleStopMotor}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-4 px-6 font-semibold transition-all flex items-center justify-center gap-2 animate-pulse"
            >
              <Square className="w-5 h-5 fill-current" />
              Motor sofort stoppen!
            </button>
          )}
        </motion.div>
      )}

      {/* Auto Plans */}
      {activeTab === 'auto' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {!showAutoPlanForm ? (
            <>
              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Auto-Fütterungspläne</h3>
                  <button
                    onClick={() => {
                      setEditingPlan(null)
                      setEditingPlanType(null)
                      setAutoPlanName('')
                      setShowAutoPlanForm(true)
                    }}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Neuer Plan
                  </button>
                </div>

                {autoPlans.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Noch keine Auto-Pläne erstellt</p>
                    <p className="text-sm mt-2">Erstelle einen Plan mit festen Fütterungszeiten</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {autoPlans.map((plan, idx) => {
                      // Get feeding times from first day to show preview
                      const firstDay = plan.selectedDays[0]
                      const feedingTimes = plan.feedingSchedule[firstDay] || []

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "glass rounded-lg p-4 transition-all",
                            plan.active ? "ring-2 ring-green-500 bg-green-500/5" : "opacity-70"
                          )}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{plan.planName}</h4>
                                {plan.active && (
                                  <span className="bg-green-500/20 text-green-500 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    Aktiv
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{plan.selectedDays.length} Tage • {plan.dailyWeight}g/Tag</p>
                            </div>
                            <div className="flex gap-2">
                              {!plan.active && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    activatePlan(plan.planName, 'auto')
                                  }}
                                  className="text-green-500 hover:bg-green-500/10 p-2 rounded-lg transition-all"
                                  title="Plan aktivieren"
                                >
                                  <Play className="w-4 h-4 fill-current" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditingAutoPlan(plan)
                                }}
                                className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-all"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deletePlan(plan.planName, 'auto')
                                }}
                                className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {feedingTimes.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {feedingTimes.map((feeding, feedIdx) => (
                                <div key={feedIdx} className="flex items-center gap-1.5 bg-background/50 rounded-md px-2 py-1 text-xs">
                                  <Clock className="w-3 h-3 text-primary" />
                                  <span className="font-medium">{feeding.time}</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-primary">{feeding.weight}g</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{editingPlan ? 'Auto-Plan bearbeiten' : 'Neuer Auto-Plan'}</h3>
                <button onClick={cancelEdit} className="hover:bg-white/10 p-2 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Plan-Name</label>
                <input
                  type="text"
                  value={autoPlanName}
                  onChange={(e) => setAutoPlanName(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="z.B. Wochentags-Plan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tägliche Gesamtmenge (Gramm)</label>
                <input
                  type="number"
                  value={dailyWeight}
                  onChange={(e) => setDailyWeight(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Fütterungen pro Tag</label>
                <input
                  type="number"
                  value={feedingsPerDay}
                  onChange={(e) => setFeedingsPerDay(parseInt(e.target.value))}
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
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
                      className="bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
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
                        'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        selectedDays.includes(day)
                          ? 'bg-primary text-primary-foreground'
                          : 'glass hover:bg-white/10'
                      )}
                    >
                      {day.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveAutoPlan}
                disabled={!autoPlanName || selectedDays.length === 0}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-3 px-6 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {editingPlan ? 'Plan aktualisieren' : 'Plan erstellen'}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Random Plans */}
      {activeTab === 'random' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {!showRandomPlanForm ? (
            <>
              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Random-Fütterungspläne</h3>
                  <button
                    onClick={() => {
                      setEditingPlan(null)
                      setEditingPlanType(null)
                      setRandomPlanName('')
                      setShowRandomPlanForm(true)
                    }}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Neuer Plan
                  </button>
                </div>

                {randomPlans.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Shuffle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Noch keine Random-Pläne erstellt</p>
                    <p className="text-sm mt-2">Erstelle einen Plan mit zufälligen Fütterungszeiten</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {randomPlans.map((plan, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "glass rounded-lg p-4 transition-all",
                          plan.active ? "ring-2 ring-green-500 bg-green-500/5" : "opacity-70"
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{plan.planName}</h4>
                              {plan.active && (
                                <span className="bg-green-500/20 text-green-500 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                  Aktiv
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {plan.feedingsPerDay}x täglich • {plan.startTime}-{plan.endTime}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {!plan.active && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  activatePlan(plan.planName, 'random')
                                }}
                                className="text-green-500 hover:bg-green-500/10 p-2 rounded-lg transition-all"
                                title="Plan aktivieren"
                              >
                                <Play className="w-4 h-4 fill-current" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditingRandomPlan(plan)
                              }}
                              className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-all"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deletePlan(plan.planName, 'random')
                              }}
                              className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 bg-background/50 rounded-md px-2 py-1 text-xs">
                            <span className="text-muted-foreground">Pro Fütterung:</span>
                            <span className="text-primary font-medium">{plan.weightPerFeeding}g</span>
                          </div>
                          {plan.minIntervalMinutes && (
                            <div className="flex items-center gap-1.5 bg-background/50 rounded-md px-2 py-1 text-xs">
                              <span className="text-muted-foreground">Mindestabstand:</span>
                              <span className="text-primary font-medium">{plan.minIntervalMinutes} Min</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 bg-background/50 rounded-md px-2 py-1 text-xs">
                            <span className="text-muted-foreground">Tage:</span>
                            <span className="text-primary font-medium">{plan.selectedDays.length}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{editingPlan ? 'Random-Plan bearbeiten' : 'Neuer Random-Plan'}</h3>
                <button onClick={cancelEdit} className="hover:bg-white/10 p-2 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Plan-Name</label>
                <input
                  type="text"
                  value={randomPlanName}
                  onChange={(e) => setRandomPlanName(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
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
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End-Zeit</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Fütterungen pro Tag</label>
                <input
                  type="number"
                  value={randomFeedingsPerDay}
                  onChange={(e) => setRandomFeedingsPerDay(parseInt(e.target.value))}
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
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
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mindestabstand (Minuten)</label>
                <input
                  type="number"
                  value={minInterval}
                  onChange={(e) => setMinInterval(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-foreground"
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
                        'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        randomSelectedDays.includes(day)
                          ? 'bg-primary text-primary-foreground'
                          : 'glass hover:bg-white/10'
                      )}
                    >
                      {day.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveRandomPlan}
                disabled={!randomPlanName || randomSelectedDays.length === 0}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-3 px-6 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {editingPlan ? 'Plan aktualisieren' : 'Plan erstellen'}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

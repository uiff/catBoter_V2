import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  TrendingUp,
  Calendar,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Clock,
  Scale
} from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/lib/config'

interface DailyData {
  date: string
  total: number
  feedings: number
  avg_per_feeding: number
  min: number
  max: number
}

interface TodayFeeding {
  time: string
  amount: number
  type: 'auto' | 'manual' | 'random'
  status: boolean
}

interface DiskInfo {
  total: number
  used: number
  free: number
  percent: number
}

export function Monitoring() {
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [todayFeedings, setTodayFeedings] = useState<TodayFeeding[]>([])
  const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch daily data (last 7 days)
      const dailyRes = await fetch(`${config.apiBaseUrl}/api/consumption/daily?days=7`)
      if (dailyRes.ok) {
        const data = await dailyRes.json()
        setDailyData(data)
      }

      // Fetch today's detailed feedings
      const todayRes = await fetch(`${config.apiBaseUrl}/api/consumption/today_detailed`)
      if (todayRes.ok) {
        const data = await todayRes.json()
        setTodayFeedings(data.feedings || [])
      }

      // Stats are calculated from dailyData, no need to fetch separately

      // Fetch disk info
      const diskRes = await fetch(`${config.apiBaseUrl}/system/disk`)
      if (diskRes.ok) {
        const data = await diskRes.json()
        if (data.total && data.free) {
          // Backend returns GB values directly, convert to bytes for consistency
          const total = data.total * 1024 * 1024 * 1024
          const free = data.free * 1024 * 1024 * 1024
          const used = data.used ? data.used * 1024 * 1024 * 1024 : total - free
          const percent = data.percent || (used / total) * 100
          setDiskInfo({ total, used, free, percent })
        }
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
      toast.error('Fehler beim Laden der Monitoring-Daten')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Calculate feeding reliability (completed vs planned)
  const completedFeedings = todayFeedings.filter(f => f.status).length
  const totalPlanned = todayFeedings.filter(f => f.type !== 'manual').length
  const reliabilityPercent = totalPlanned > 0
    ? Math.round((completedFeedings / todayFeedings.length) * 100)
    : 100

  // Calculate 7-day average
  const sevenDayAvg = dailyData.length > 0
    ? Math.round((dailyData.reduce((sum, d) => sum + d.total, 0) / dailyData.length) * 10) / 10
    : 0

  // Calculate consistency score (lower variation = more consistent)
  const amounts = dailyData.map(d => d.total)
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length || 0
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avgAmount, 2), 0) / amounts.length || 0
  const stdDev = Math.sqrt(variance)
  const consistencyScore = avgAmount > 0 ? Math.max(0, 100 - (stdDev / avgAmount) * 100) : 100

  // Format bytes to GB
  const formatGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(1)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Total */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-primary">
            {todayFeedings.reduce((sum, f) => sum + f.amount, 0).toFixed(1)}g
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Heute gefüttert</p>
          <p className="text-xs text-muted-foreground mt-2">
            {todayFeedings.length} Fütterungen
          </p>
        </motion.div>

        {/* 7-Day Average */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-blue-500">{sevenDayAvg}g</h3>
          <p className="text-sm text-muted-foreground mt-1">7-Tage Durchschnitt</p>
          <p className="text-xs text-muted-foreground mt-2">
            Letzte {dailyData.length} Tage
          </p>
        </motion.div>

        {/* Reliability Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-green-500">{reliabilityPercent}%</h3>
          <p className="text-sm text-muted-foreground mt-1">Zuverlässigkeit</p>
          <p className="text-xs text-muted-foreground mt-2">
            {completedFeedings} von {todayFeedings.length} erfolgreich
          </p>
        </motion.div>

        {/* Consistency Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-purple-500">
            {Math.round(consistencyScore)}%
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Konsistenz</p>
          <p className="text-xs text-muted-foreground mt-2">
            Gleichmäßigkeit der Fütterungen
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">7-Tage Trend</h2>
          </div>

          {dailyData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Noch keine historischen Daten verfügbar
            </p>
          ) : (
            <div className="space-y-3">
              {dailyData.slice().reverse().map((day, index) => {
                const date = new Date(day.date)
                const isToday = date.toDateString() === new Date().toDateString()
                const maxTotal = Math.max(...dailyData.map(d => d.total), 1)
                const barWidth = (day.total / maxTotal) * 100

                return (
                  <div key={day.date} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={isToday ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                        {isToday ? 'Heute' : date.toLocaleDateString('de-DE', {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {day.feedings} Fütterungen
                        </span>
                        <span className="font-semibold">{day.total}g</span>
                      </div>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        className={`h-full ${isToday ? 'bg-primary' : 'bg-primary/60'} rounded-full`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Today's Feeding Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Heutige Aktivitäten</h2>
          </div>

          {todayFeedings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Heute noch keine Fütterungen
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {todayFeedings.map((feeding, index) => {
                const typeColors = {
                  auto: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                  random: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                  manual: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                }

                const typeLabels = {
                  auto: 'Auto',
                  random: 'Random',
                  manual: 'Manuell'
                }

                return (
                  <motion.div
                    key={`${feeding.time}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-lg border ${
                      feeding.status
                        ? 'bg-background/30 border-border/50'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {feeding.status ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{feeding.time}</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${typeColors[feeding.type]}`}>
                              {typeLabels[feeding.type]}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {feeding.status ? 'Erfolgreich' : 'Geplant'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">{feeding.amount}g</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Storage Info */}
      {diskInfo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Speicherplatz</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Belegt</span>
              <span className="font-semibold">{formatGB(diskInfo.used)} GB</span>
            </div>
            <div className="h-3 bg-background rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${diskInfo.percent}%` }}
                transition={{ duration: 1 }}
                className={`h-full rounded-full ${
                  diskInfo.percent > 90
                    ? 'bg-red-500'
                    : diskInfo.percent > 80
                    ? 'bg-orange-500'
                    : 'bg-primary'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Frei: {formatGB(diskInfo.free)} GB
              </span>
              <span className="text-muted-foreground">
                Total: {formatGB(diskInfo.total)} GB
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

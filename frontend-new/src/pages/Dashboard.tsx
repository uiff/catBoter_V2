import { useState, useEffect } from 'react'
import { Container, Droplets, Weight } from 'lucide-react'
import { toast } from 'sonner'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { ConsumptionChart } from '@/components/dashboard/ConsumptionChart'
import { RecentFeedings } from '@/components/dashboard/RecentFeedings'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { useSensorData } from '@/hooks/useSensorData'
import { useConsumptionData } from '@/hooks/useConsumptionData'
import { formatGrams, formatPercent } from '@/lib/utils'
import { config } from '@/lib/config'

export function Dashboard() {
  const { data, refresh } = useSensorData()
  const { history, today } = useConsumptionData()
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  // Keep last valid values to prevent "---" flashing
  const distance = data?.distance ?? 0
  const weight = data?.weight ?? 0
  const totalConsumed = data?.total_consumed_today ?? 0

  const getDistanceStatus = (distance: number | null) => {
    if (!distance) return 'danger'
    if (distance >= 60) return 'good'
    if (distance >= 30) return 'warning'
    return 'danger'
  }

  const handleManualFeed = async () => {
    const loadingToast = toast.loading('Fütterung wird gestartet...')

    try {
      const response = await fetch(`${config.apiBaseUrl}/motor/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 30.0,  // 30g default
          timeout: 120   // 2 minutes timeout
        })
      })

      const result = await response.json()

      toast.dismiss(loadingToast)

      if (result.success) {
        toast.success('Fütterung erfolgreich!', {
          description: result.message
        })
        refresh() // Sofort aktualisieren, kein Timeout
      } else {
        toast.error('Fütterung fehlgeschlagen', {
          description: result.message
        })
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Verbindungsfehler', {
        description: 'Konnte nicht mit dem Backend kommunizieren'
      })
      console.error('Fehler beim Füttern:', error)
    }
  }

  const handleStop = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/motor/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Motor gestoppt', {
          description: result.message
        })
        refresh() // Sofort aktualisieren, kein Timeout
      } else {
        toast.error('Stop fehlgeschlagen', {
          description: result.message
        })
      }
    } catch (error) {
      toast.error('Verbindungsfehler', {
        description: 'Konnte nicht mit dem Backend kommunizieren'
      })
      console.error('Fehler beim Stoppen:', error)
    }
  }

  // Low tank level notification
  useEffect(() => {
    if (distance > 0 && distance < 20) {
      toast.warning('Füllstand niedrig!', {
        description: `Tank ist nur noch bei ${distance}% - Bitte auffüllen`,
        duration: 10000,
      })
    }
  }, [distance])

  return (
    <div className="space-y-6">
      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          icon={Container}
          label="Tankfüllstand"
          value={formatPercent(distance)}
          status={getDistanceStatus(distance)}
        />
        <MetricCard
          icon={Weight}
          label="Napfgewicht"
          value={formatGrams(weight)}
          status="good"
        />
        <MetricCard
          icon={Droplets}
          label="Heute gefüttert"
          value={formatGrams(totalConsumed)}
          status="good"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions
        onManualFeed={handleManualFeed}
        onStop={handleStop}
        isMotorRunning={data?.motor === 1}
      />

      {/* Statistics Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Statistiken</h2>
        <PeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {/* Charts and Feedings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {history?.daily && history.daily.length > 0 && (
            <ConsumptionChart data={history.daily} period={period} />
          )}
        </div>
        <div>
          {today && (
            <RecentFeedings feedings={today.feedings} date={today.date} />
          )}
        </div>
      </div>
    </div>
  )
}

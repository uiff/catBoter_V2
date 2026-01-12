import { useState, useEffect, useRef } from 'react'
import { Container, Droplets, Weight } from 'lucide-react'
import { toast } from 'sonner'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { ConsumptionChart } from '@/components/dashboard/ConsumptionChart'
import { RecentFeedings } from '@/components/dashboard/RecentFeedings'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { useSensorData } from '@/hooks/useSensorData'
import { useConsumptionData } from '@/hooks/useConsumptionData'
import { useTankCalibration } from '@/hooks/useTankCalibration'
import { formatGrams, formatPercent, distanceToPercent } from '@/lib/utils'
import { config } from '@/lib/config'

export function Dashboard() {
  const { data, refresh } = useSensorData()
  const { history, today } = useConsumptionData()
  const tankCalibration = useTankCalibration()
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [lowTankAcknowledged, setLowTankAcknowledged] = useState(false)
  const lowTankToastId = useRef<string | number | null>(null)

  // Keep last valid values to prevent "---" flashing
  const distanceRaw = data?.distance ?? null  // null wenn nicht verfügbar
  const weight = data?.weight ?? 0
  const totalConsumed = data?.total_consumed_today ?? 0

  // Konvertiere Distanz (cm) zu Füllstand (%) mit Kalibrierung
  const tankLevel = distanceToPercent(distanceRaw, tankCalibration.min_distance, tankCalibration.max_distance)

  const getDistanceStatus = (percent: number) => {
    if (percent >= 60) return 'good'
    if (percent >= 30) return 'warning'
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

  // Low tank level notification with acknowledgment
  useEffect(() => {
    // Reset acknowledgment wenn Tank wieder aufgefüllt wurde (> 30%)
    if (tankLevel > 30) {
      if (lowTankAcknowledged) {
        setLowTankAcknowledged(false)
      }
      // Dismiss existing toast wenn Tank wieder ok
      if (lowTankToastId.current !== null) {
        toast.dismiss(lowTankToastId.current)
        lowTankToastId.current = null
      }
      return
    }

    // Zeige Warnung nur wenn nicht quittiert, Tank niedrig und noch kein Toast aktiv
    if (tankLevel > 0 && tankLevel < 20 && !lowTankAcknowledged && lowTankToastId.current === null) {
      const toastId = toast.warning('Füllstand niedrig!', {
        description: `Tank ist nur noch bei ${Math.round(tankLevel)}% - Bitte auffüllen`,
        duration: Infinity, // Bleibt bis quittiert
        action: {
          label: 'Quittieren',
          onClick: () => {
            setLowTankAcknowledged(true)
            toast.dismiss(toastId)
            lowTankToastId.current = null
          }
        }
      })
      lowTankToastId.current = toastId
    }
  }, [tankLevel, lowTankAcknowledged])

  return (
    <div className="space-y-6">
      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          icon={Container}
          label="Tankfüllstand"
          value={formatPercent(tankLevel)}
          status={getDistanceStatus(tankLevel)}
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

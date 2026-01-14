import { useState, useEffect, useCallback } from 'react'
import { config } from '@/lib/config'

interface DailyData {
  date: string
  total: number
  feedings: number
  avg_per_feeding: number
  min: number
  max: number
}

interface WeeklyData {
  week: string
  start_date: string
  end_date: string
  total: number
  avg_daily: number
  days: number
}

interface MonthlyData {
  month: string
  total: number
  avg_daily: number
  days: number
}

interface ConsumptionHistory {
  daily: DailyData[]
  weekly: WeeklyData[]
  monthly: MonthlyData[]
  yearly: any[]
}

interface TodayData {
  date: string
  feedings: Array<{
    time: string
    amount: number
    type?: 'auto' | 'manual'
    status?: boolean | null
    planned_amount?: number
  }>
  total: number
}

export function useConsumptionData() {
  const [history, setHistory] = useState<ConsumptionHistory | null>(null)
  const [today, setToday] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch all consumption data in parallel
      const [dailyRes, weeklyRes, monthlyRes, yearlyRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/consumption/daily`),
        fetch(`${config.apiBaseUrl}/consumption/weekly`),
        fetch(`${config.apiBaseUrl}/consumption/monthly`),
        fetch(`${config.apiBaseUrl}/consumption/yearly`)
      ])

      if (!dailyRes.ok || !weeklyRes.ok || !monthlyRes.ok || !yearlyRes.ok) {
        throw new Error('Failed to fetch consumption history')
      }

      const [daily, weekly, monthly, yearly] = await Promise.all([
        dailyRes.json(),
        weeklyRes.json(),
        monthlyRes.json(),
        yearlyRes.json()
      ])

      setHistory({ daily, weekly, monthly, yearly })
      setError(null)
    } catch (err) {
      console.error('Error fetching consumption history:', err)
      setError('Fehler beim Laden der Verbrauchsdaten')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/consumption/today_detailed`)
      if (!res.ok) {
        throw new Error('Failed to fetch today\'s data')
      }
      const data = await res.json()
      setToday(data)
    } catch (err) {
      console.error('Error fetching today\'s data:', err)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
    fetchToday()

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchHistory()
      fetchToday()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchHistory, fetchToday])

  return {
    history,
    today,
    loading,
    error,
    refresh: () => {
      fetchHistory()
      fetchToday()
    }
  }
}

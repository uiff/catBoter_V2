import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DailyData {
  date: string
  total: number
  feedings: number
  avg_per_feeding: number
  min: number
  max: number
}

interface ConsumptionChartProps {
  data: DailyData[]
  period: 'week' | 'month'
}

export function ConsumptionChart({ data, period }: ConsumptionChartProps) {
  const chartData = useMemo(() => {
    // Get last 7 or 30 days
    const days = period === 'week' ? 7 : 30
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const recent = sorted.slice(-days)

    return recent.map(item => ({
      date: new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      'Gesamt (g)': item.total,
      'Fütterungen': item.feedings,
    }))
  }, [data, period])

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-6">
        Verbrauchsverlauf ({period === 'week' ? 'Letzte 7 Tage' : 'Letzte 30 Tage'})
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.5)"
            tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
          />
          <YAxis
            stroke="rgba(255,255,255,0.5)"
            tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(6, 182, 212, 0.5)',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#fff' }}
            itemStyle={{ color: '#06b6d4' }}
          />
          <Legend
            wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }}
          />
          <Bar
            dataKey="Gesamt (g)"
            fill="#06b6d4"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="Fütterungen"
            fill="#a855f7"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

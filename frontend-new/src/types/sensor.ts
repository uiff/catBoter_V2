export interface SensorData {
  distance: number | null
  weight: number | null
  motor: number
  total_consumed_today: number
  timestamp: string
  last_feeding?: string
}

export interface FeedingEvent {
  id: string
  timestamp: string
  amount: number
  status: 'success' | 'error' | 'pending'
  mode: 'manual' | 'auto' | 'random'
}

export interface SystemStatus {
  cpu: number
  temperature: number
  ram: number
  disk: number
  uptime: number
}

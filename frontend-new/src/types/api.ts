/** API- und Socket-Typen - Vertrag mit dem Backend (services/realtime.py, api/routes_*.py). */

export interface TankStatus {
  distance_cm: number | null
  percent: number | null
  state: 'ok' | 'low' | 'empty' | 'unknown'
  /** Geschätzte Reichweite in Tagen (null solange zu wenig Lerndaten) */
  range_days?: number | null
}

export interface SensorSnapshot {
  weight: number | null
  tank: TankStatus
  motor_running: boolean
  today_total: number
  /** ISO-String vom Backend */
  timestamp: string
}

export type FeedingSource = 'manual' | 'plan'

export interface FeedingStarted {
  source: FeedingSource
  target_grams: number
}

export interface FeedingProgress {
  source: FeedingSource
  fed_grams: number
  target_grams: number
  elapsed_s: number
}

export interface FeedingCompleted {
  source: FeedingSource
  success: boolean
  aborted: boolean
  fed_grams: number
  target_grams: number
  message: string
}

export interface MotorStatus {
  running: boolean
  /** Nur MANUELLE Fütterungen werden hier gemeldet - Plan-Fütterungen
   *  erscheinen ausschliesslich über die feeding_*-Socket-Events. */
  active_feeding: { source: 'manual'; target_grams: number; fed_grams: number } | null
}

export interface TodayFeeding {
  time: string
  amount: number
  type: 'auto' | 'random' | 'manual'
  status: boolean | null
  planned_amount: number
  /** Smart-Feed: übersprungen, weil der Napf noch gefüllt war */
  skipped?: boolean
}

export interface TodayDetailed {
  date: string
  total: number
  feedings: TodayFeeding[]
}

export interface DailyEntry {
  date: string
  total: number
  feedings: number
  avg_per_feeding: number
  min: number
  max: number
}

export interface ConsumptionStats {
  avg_daily: number
  avg_weekly: number
  avg_monthly: number
  total_feedings: number
}

export interface TankCalibration {
  min_distance: number
  max_distance: number
}

export interface InterfaceStatus {
  up: boolean
  ip: string | null
}

export interface NetworkInfo {
  current_ip: string
  wifi_ssid: string | null
  wifi_signal_dbm: number | null
  interfaces?: {
    eth0?: InterfaceStatus
    wlan0?: InterfaceStatus
  }
}

export interface WifiNetwork {
  ssid: string
  signal_dbm: number | null
  encrypted: boolean
}

export interface FallbackStatus {
  service_running: boolean
  network_connected?: boolean
  ap_active?: boolean
  failed_checks?: number
  ssid?: string | null
  message?: string
}

export interface FallbackConfig {
  enabled: boolean
  ssid: string
  password: string
  channel: number
  check_interval: number
}

export interface SystemStats {
  cpu_percent: number
  temperature: number | null
  memory: { total: number; available: number; percent: number; used: number; free: number }
  disk: { total: number; used: number; free: number; percent: number }
}

export interface TimeStatus {
  current_time: string
  timezone: string | null
  managed_by: 'host'
}

export interface MqttSettings {
  enabled: boolean
  host: string
  port: number
  username: string
  /** Wird vom Backend immer maskiert zurückgegeben */
  password: string
}

export interface CatProfile {
  weight_kg: number | null
  age_years: number | null
  activity: 'ruhig' | 'normal' | 'aktiv'
  kcal_per_100g: number | null
}

export interface AppSettings {
  tank_warn_percent: number
  smart_feed: boolean
  /** ISO-Zeitpunkt bis zu dem Plan-Fütterungen pausieren (null = aktiv) */
  paused_until: string | null
  untouched_alert_hours: number
  mqtt: MqttSettings
  ha_discovery: boolean
  cat_profile: CatProfile
}

export interface HealthStats {
  recent: Array<{ ts: string; minutes: number; start_weight: number }>
  avg_minutes: number | null
  untouched_hours: number
  bowl_weight: number | null
}

export interface EventEntry {
  ts: string
  type: string
  detail: string
  grams?: number
}

export interface BackupInfo {
  exists: boolean
  size?: number
  created?: string
}

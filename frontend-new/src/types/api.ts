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
  /** 'hand': von Hand nachgefüllt (die Waage hat den Anstieg erkannt) */
  type: 'auto' | 'random' | 'manual' | 'hand'
  status: boolean | null
  planned_amount: number
  /** Übersprungen: Napf noch gefüllt (Smart-Feed) oder Diät-Budget erreicht */
  skipped?: boolean
  skipped_diet?: boolean
  /** Wer hat diese Ausgabe gefressen (erkannte/gelabelte Episoden, g je Katze) */
  eaten_by?: Record<string, number>
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
  /** Passwort des Notfall-Hotspots (wird beim ersten Start zufällig erzeugt) */
  ap_password?: string | null
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
  name: string
  weight_kg: number | null
  age_years: number | null
  activity: 'ruhig' | 'normal' | 'aktiv'
  /** Just-in-Time: Tagesbudget dieser Katze in g (null = unbegrenzt) */
  budget_g?: number | null
  /** Just-in-Time: garantierte Mindestmenge - unterhalb wird NIE gesperrt */
  min_g?: number | null
}

export interface CatProfiles {
  /** Gemeinsames Futter - eine Energieangabe für alle Katzen */
  kcal_per_100g: number | null
  cats: CatProfile[]
}

export interface DietSettings {
  enabled: boolean
  target_grams: number | null
  /** Sanfte Rampe: max. 5 %/Woche (Katzen-Sicherheit, hepatische Lipidose) */
  weekly_reduction_pct: number
  start_date: string | null
  start_grams: number | null
}

export interface DietStatus {
  enabled: boolean
  budget_today: number | null
  consumed_today: number
  remaining: number | null
  target_grams: number | null
  start_grams: number | null
  weekly_reduction_pct: number | null
  start_date: string | null
  /** true sobald die Rampe das Zielbudget erreicht hat */
  at_target: boolean | null
}

export interface JitSettings {
  /** Just-in-Time-Dosierung aktiv (greift erst, wenn die Erkennung gelernt hat) */
  enabled: boolean
  starter_grams: number
}

export interface AppSettings {
  tank_warn_percent: number
  smart_feed: boolean
  /** ISO-Zeitpunkt bis zu dem Plan-Fütterungen pausieren (null = aktiv) */
  paused_until: string | null
  untouched_alert_hours: number
  mqtt: MqttSettings
  ha_discovery: boolean
  cat_profiles: CatProfiles
  diet: DietSettings
  jit: JitSettings
}

export interface EatingLive {
  eating: boolean
  consumed: number
  duration_s: number
  rate: number | null
  /** Live-Vermutung, welche Katze gerade frisst (null = unbekannt/zu früh) */
  guess: string | null
  confidence: number | null
}

export interface EatingEpisode {
  id: string
  ts: string
  consumed: number
  duration_s: number
  rate: number
  mean_bite: number
  pauses: number
  max_spike: number
  hour: number
  /** Vom Nutzer zugeordnete Katze (autoritativ) */
  label: string | null
  /** Vom Klassifikator zugeordnete Katze (ab genug Labels) */
  auto_label: string | null
  confidence: number | null
}

export interface ClassifierStatus {
  labels: Record<string, number>
  needed_per_cat: number
  active: boolean
}

export interface EatingData {
  episodes: EatingEpisode[]
  classifier: ClassifierStatus
  per_cat_today: Record<string, number>
}

export interface AppetiteState {
  state: 'ok' | 'low' | 'high'
  baseline: number | null
  yesterday: number | null
  streak_low: number
  streak_high: number
}

export interface HealthStats {
  recent: Array<{ ts: string; minutes: number; start_weight: number }>
  avg_minutes: number | null
  untouched_hours: number
  bowl_weight: number | null
  appetite?: AppetiteState
}

export interface Freshness {
  food_age_days: number | null
  food_stale: boolean
  bowl_clean_days: number | null
  bowl_due: boolean
  tank_clean_days: number | null
  tank_due: boolean
}

export interface Reminder {
  id: string
  title: string
  cat: string
  interval_days: number
  next_due: string
  last_done: string | null
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

/** Typisierter API-Client - die EINZIGE fetch-Stelle der App. */
import type {
  AppSettings,
  ConsumptionStats,
  DailyEntry,
  FallbackConfig,
  FallbackStatus,
  MotorStatus,
  NetworkInfo,
  SensorSnapshot,
  SystemStats,
  TankCalibration,
  TankStatus,
  TimeStatus,
  TodayDetailed,
  WifiNetwork,
} from '@/types/api'
import type { AutoPlan, RandomPlan } from '@/types/feeding'

const API = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

/** AbortSignal.timeout mit Fallback für ältere Browser/WebViews (iOS < 16, ältere Android-WebViews). */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 10_000, ...rest } = init ?? {}
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      headers: rest.body ? { 'Content-Type': 'application/json' } : undefined,
      signal: timeoutSignal(timeoutMs),
      ...rest,
    })
  } catch (e) {
    // Ältere Engines werfen 'AbortError' statt 'TimeoutError'
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new ApiError(0, 'Zeitüberschreitung - Backend nicht erreichbar')
    }
    throw new ApiError(0, 'Netzwerkfehler - Backend nicht erreichbar')
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* kein JSON-Body */
  }

  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? `Fehler ${res.status}`
    throw new ApiError(res.status, message)
  }
  return body as T
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined })
const put = <T>(path: string, data: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(data) })
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })

export const api = {
  // Dashboard / Sensorik
  getDashboard: () => get<SensorSnapshot>('/dashboard'),
  getDistance: (fresh = false) => get<TankStatus>(`/distance${fresh ? '?fresh=1' : ''}`),
  tare: () => post<{ success: boolean; message: string }>('/weight/tare'),
  calibrateWeight: (knownWeight: number) =>
    post<{ success: boolean; message: string }>('/weight/calibrate', { known_weight: knownWeight }),
  getTankCalibration: () => get<TankCalibration>('/tank/calibration'),
  setTankCalibration: (cal: TankCalibration) =>
    post<{ success: boolean } & TankCalibration>('/tank/calibration', cal),

  // Motor / Fütterung
  getMotorStatus: () => get<MotorStatus>('/motor/status'),
  manualFeed: (grams: number) =>
    post<{ status: string; target_grams: number }>('/motor/feed', { amount: grams }),
  stopFeeding: () => post<{ success: boolean; message: string }>('/motor/stop'),

  // Pläne
  getAutoPlans: () => get<AutoPlan[]>('/feeding_plan'),
  createAutoPlan: (plan: AutoPlan) => post<{ message: string }>('/feeding_plan', plan),
  updateAutoPlan: (name: string, plan: AutoPlan) =>
    put<{ message: string }>(`/feeding_plan/${encodeURIComponent(name)}`, plan),
  deleteAutoPlan: (name: string) =>
    del<{ message: string }>(`/feeding_plan/${encodeURIComponent(name)}`),
  activateAutoPlan: (name: string) =>
    post<{ message: string }>('/feeding_plan/load', { planName: name }),
  getRandomPlans: () => get<RandomPlan[]>('/random_plans'),
  createRandomPlan: (plan: RandomPlan) => post<{ message: string }>('/random_plan', plan),
  updateRandomPlan: (name: string, plan: RandomPlan) =>
    put<{ message: string }>(`/random_plan/${encodeURIComponent(name)}`, plan),
  deleteRandomPlan: (name: string) =>
    del<{ message: string }>(`/random_plan/${encodeURIComponent(name)}`),
  activateRandomPlan: (name: string) =>
    post<{ message: string; feedingTimes?: string[] }>('/random_plan/activate', { planName: name }),
  regenerateRandomTimes: () =>
    post<{ message: string; feedingTimes?: string[] }>('/random_plan/generate_now'),

  // Statistik
  getToday: () => get<TodayDetailed>('/consumption/today_detailed'),
  getDaily: (days: number) => get<DailyEntry[]>(`/consumption/daily?days=${days}`),
  getConsumptionStats: () => get<ConsumptionStats>('/consumption/stats'),

  // System
  getSystemStats: () => get<SystemStats>('/system/stats'),
  getNetworkInfo: () => get<NetworkInfo>('/system/network'),
  scanWifi: () =>
    request<{ networks: WifiNetwork[] }>('/system/scan_wifi', { timeoutMs: 30_000 }),
  connectWifi: (ssid: string, password: string) =>
    request<{ success: boolean; message: string; network?: NetworkInfo }>('/system/connect_wifi', {
      method: 'POST',
      body: JSON.stringify({ ssid, password }),
      timeoutMs: 45_000,
    }),
  getFallbackStatus: () => get<FallbackStatus>('/system/wifi_fallback/status'),
  getFallbackConfig: () => get<FallbackConfig>('/system/wifi_fallback/config'),
  setFallbackConfig: (config: Partial<FallbackConfig>) =>
    post<{ success: boolean; message: string }>('/system/wifi_fallback/config', config),
  enableAp: () => post<{ status: string; message: string }>('/system/wifi_fallback/enable_ap'),
  disableAp: () => post<{ status: string; message: string }>('/system/wifi_fallback/disable_ap'),
  getTimeStatus: () => get<TimeStatus>('/system/time_status'),
  getAppSettings: () => get<AppSettings>('/system/settings'),
  setAppSettings: (settings: Partial<AppSettings>) =>
    post<{ success: boolean } & AppSettings>('/system/settings', settings),
  restartBackend: () => post<{ success: boolean; message: string }>('/system/restart_backend'),
  rebootHost: () => post<{ success: boolean; message: string }>('/system/reboot'),
  shutdownHost: () => post<{ success: boolean; message: string }>('/system/shutdown'),
}

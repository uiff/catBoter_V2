/** Die EINZIGE Socket.IO-Verbindung der App (vorher: drei pro Tab). */
import { io, type Socket } from 'socket.io-client'
import { create } from 'zustand'
import type {
  FeedingCompleted,
  FeedingProgress,
  FeedingStarted,
  SensorSnapshot,
} from '@/types/api'
import { api } from '@/lib/api'

export type Connection = 'connecting' | 'online' | 'offline'

export interface FeedingState {
  active: boolean
  source: 'manual' | 'plan'
  target_grams: number
  fed_grams: number
  /** Ergebnis der letzten abgeschlossenen Fütterung */
  result: FeedingCompleted | null
}

interface SocketState {
  sensor: SensorSnapshot | null
  connection: Connection
  feeding: FeedingState | null
  lastUpdateAt: number | null
}

export const useSocketStore = create<SocketState>(() => ({
  sensor: null,
  connection: 'connecting',
  feeding: null,
  lastUpdateAt: null,
}))

let socket: Socket | null = null
let fallbackTimer: ReturnType<typeof setInterval> | null = null
let fallbackInFlight = false
let completedListeners: Array<(result: FeedingCompleted) => void> = []
let plansUpdatedListeners: Array<() => void> = []

/** Komponenten können auf feeding_completed reagieren (z. B. Queries invalidieren). */
export function onFeedingCompleted(listener: (result: FeedingCompleted) => void) {
  completedListeners.push(listener)
  return () => {
    completedListeners = completedListeners.filter((l) => l !== listener)
  }
}

/** Reagiert auf Plan-Änderungen anderer Clients/Geräte (plans_updated-Event). */
export function onPlansUpdated(listener: () => void) {
  plansUpdatedListeners.push(listener)
  return () => {
    plansUpdatedListeners = plansUpdatedListeners.filter((l) => l !== listener)
  }
}

function startRestFallback() {
  if (fallbackTimer) return
  fallbackTimer = setInterval(async () => {
    if (fallbackInFlight) return
    fallbackInFlight = true
    try {
      const snapshot = await api.getDashboard()
      // Nur übernehmen, solange der Socket wirklich offline ist - eine späte
      // REST-Antwort darf frischere Socket-Daten nicht überschreiben
      if (useSocketStore.getState().connection === 'offline') {
        useSocketStore.setState({ sensor: snapshot, lastUpdateAt: Date.now() })
      }
    } catch {
      /* Backend weiterhin nicht erreichbar */
    } finally {
      fallbackInFlight = false
    }
  }, 5000)
}

function stopRestFallback() {
  if (fallbackTimer) {
    clearInterval(fallbackTimer)
    fallbackTimer = null
  }
}

export function connectSocket() {
  if (socket) return

  socket = io('/', { transports: ['websocket', 'polling'] })

  socket.on('connect', () => {
    useSocketStore.setState({ connection: 'online' })
    stopRestFallback()
    socket?.emit('request_update')
  })

  socket.on('disconnect', () => {
    useSocketStore.setState({ connection: 'offline' })
    startRestFallback()
  })

  socket.io.on('reconnect_attempt', () => {
    if (useSocketStore.getState().connection !== 'online') {
      startRestFallback()
    }
  })

  socket.on('sensor_update', (snapshot: SensorSnapshot) => {
    useSocketStore.setState({ sensor: snapshot, lastUpdateAt: Date.now() })
  })

  socket.on('feeding_started', (event: FeedingStarted) => {
    useSocketStore.setState({
      feeding: {
        active: true,
        source: event.source,
        target_grams: event.target_grams,
        fed_grams: 0,
        result: null,
      },
    })
  })

  socket.on('feeding_progress', (event: FeedingProgress) => {
    useSocketStore.setState((state) => ({
      feeding: {
        active: true,
        source: event.source,
        target_grams: event.target_grams,
        fed_grams: event.fed_grams,
        result: state.feeding?.result ?? null,
      },
    }))
  })

  socket.on('feeding_completed', (event: FeedingCompleted) => {
    useSocketStore.setState({
      feeding: {
        active: false,
        source: event.source,
        target_grams: event.target_grams,
        fed_grams: event.fed_grams,
        result: event,
      },
    })
    for (const listener of completedListeners) listener(event)
  })

  socket.on('plans_updated', () => {
    for (const listener of plansUpdatedListeners) listener()
  })
}

/** Ergebnis-Anzeige zurücksetzen (z. B. beim Schliessen des Feed-Sheets). */
export function clearFeedingResult() {
  const { feeding } = useSocketStore.getState()
  if (feeding && !feeding.active) {
    useSocketStore.setState({ feeding: null })
  }
}

// Bequeme Selektoren
export const useSensor = () => useSocketStore((s) => s.sensor)
export const useConnection = () => useSocketStore((s) => s.connection)
export const useFeeding = () => useSocketStore((s) => s.feeding)

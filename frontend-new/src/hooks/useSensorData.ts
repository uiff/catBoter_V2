import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { config } from '@/lib/config'
import type { SensorData } from '@/types/sensor'

// Hilfsfunktion für sanfte Wert-Übergänge (Debouncing)
function shouldUpdateValue(oldVal: number | null, newVal: number | null, threshold: number): boolean {
  if (oldVal === null || newVal === null) return true
  return Math.abs(newVal - oldVal) >= threshold
}

export function useSensorData() {
  const [data, setData] = useState<SensorData | null>(null)
  const [isConnected, setIsConnected] = useState(true) // Start optimistisch mit true
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const lastUpdateRef = useRef<string>('')
  const lastValidDataRef = useRef<SensorData | null>(null)
  const updateTimeoutRef = useRef<number | null>(null)
  const failureCountRef = useRef<number>(0) // Zähle Fehler bevor Offline

  const fetchREST = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/dashboard`, {
        signal: AbortSignal.timeout(10000) // 10 Sekunden Timeout (für langsame Sensor-Abfragen)
      })
      const jsonData = await res.json()

      // Transform dashboard data to sensor data format
      const sensorData = {
        weight: jsonData.weight,
        distance: jsonData.distance,
        motor: jsonData.motor_status,
        total_consumed_today: jsonData.total_consumed_today || 0,
        timestamp: jsonData.timestamp
      }

      // Only update if we got valid data
      if (sensorData && (sensorData.weight !== undefined || sensorData.distance !== undefined)) {
        lastValidDataRef.current = sensorData
        setData(sensorData)
        failureCountRef.current = 0 // Reset Fehlerzähler
        setIsConnected(true)
      }
      setError(null)
    } catch (err) {
      // Nur nach mehreren Fehlern als offline markieren
      failureCountRef.current++
      if (failureCountRef.current >= 3) { // Erst nach 3 Fehlern offline
        setIsConnected(false)
        setError('Connection error')
      }
      // Keep showing last valid data on error
      if (lastValidDataRef.current) {
        setData(lastValidDataRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!config.wsEnabled) {
      fetchREST()
      const interval = setInterval(fetchREST, config.refreshInterval)
      return () => clearInterval(interval)
    }

    const socket = io(config.apiBaseUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      setError(null)
      socket.emit('request_update')
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('sensor_update', (sensorData: SensorData) => {
      // Only update if data has actually changed and is valid
      if (sensorData && (sensorData.weight !== undefined || sensorData.distance !== undefined)) {
        const currentData = lastValidDataRef.current

        // Motor-Änderungen IMMER sofort anzeigen für schnelle Reaktion
        const motorChanged = currentData && currentData.motor !== sensorData.motor

        if (motorChanged) {
          // Motor-Status sofort aktualisieren
          lastValidDataRef.current = sensorData
          setData(sensorData)
          setError(null)
          failureCountRef.current = 0
        } else {
          // Andere Werte: Nur signifikante Änderungen sofort anzeigen
          const hasSignificantChange =
            !currentData ||
            shouldUpdateValue(currentData.weight, sensorData.weight, 1.0) ||
            shouldUpdateValue(currentData.distance, sensorData.distance, 1.0)

          if (hasSignificantChange) {
            // Signifikante Änderung - sofort aktualisieren
            lastValidDataRef.current = sensorData
            setData(sensorData)
            setError(null)
            failureCountRef.current = 0
          } else {
            // Kleine Änderung - verzögert aktualisieren (debounce)
            if (updateTimeoutRef.current) {
              clearTimeout(updateTimeoutRef.current)
            }
            updateTimeoutRef.current = setTimeout(() => {
              lastValidDataRef.current = sensorData
              setData(sensorData)
              setError(null)
            }, 100) // Nur 100ms Verzögerung für kleine Änderungen
          }
        }

        lastUpdateRef.current = JSON.stringify(sensorData)
      }
    })

    socket.on('connect_error', () => {
      setIsConnected(false)
      fetchREST()
    })

    fetchREST()

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      socket.disconnect()
    }
  }, [fetchREST])

  const refresh = useCallback(() => {
    if (isConnected && socketRef.current) {
      socketRef.current.emit('request_update')
    } else {
      fetchREST()
    }
  }, [isConnected, fetchREST])

  return { data, isConnected, error, refresh }
}

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
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const lastUpdateRef = useRef<string>('')
  const lastValidDataRef = useRef<SensorData | null>(null)
  const updateTimeoutRef = useRef<number | null>(null)

  const fetchREST = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/dashboard`)
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
        setIsConnected(true) // Set connected when data is received
      }
      setError(null)
    } catch (err) {
      console.error('REST fetch error:', err)
      setError('Connection error')
      setIsConnected(false)
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
        // Debouncing: Nur signifikante Änderungen sofort anzeigen
        const currentData = lastValidDataRef.current
        const hasSignificantChange =
          !currentData ||
          shouldUpdateValue(currentData.weight, sensorData.weight, 0.5) ||
          shouldUpdateValue(currentData.distance, sensorData.distance, 0.5) ||
          currentData.motor !== sensorData.motor

        if (hasSignificantChange) {
          // Signifikante Änderung - sofort aktualisieren
          lastValidDataRef.current = sensorData
          setData(sensorData)
          setError(null)
        } else {
          // Kleine Änderung - verzögert aktualisieren (debounce)
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
          }
          updateTimeoutRef.current = setTimeout(() => {
            lastValidDataRef.current = sensorData
            setData(sensorData)
            setError(null)
          }, 300) // 0.3 Sekunden Verzögerung für kleine Änderungen
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

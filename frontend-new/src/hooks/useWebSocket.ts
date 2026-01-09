import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { config } from '@/lib/config'

interface SensorData {
  weight: number | null
  distance: number | null
  motor: number
  total_consumed_today: number
  timestamp: number
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [sensorData, setSensorData] = useState<SensorData>({
    weight: null,
    distance: null,
    motor: 0,
    total_consumed_today: 0,
    timestamp: 0
  })
  const socketRef = useRef<Socket | null>(null)
  const lastUpdateRef = useRef<string>('')

  useEffect(() => {
    // Skip WebSocket if disabled in config
    if (!config.wsEnabled) {
      return
    }

    // Create socket connection
    const newSocket = io(config.apiBaseUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    })

    socketRef.current = newSocket

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected')
      setIsConnected(true)
      newSocket.emit('request_update')
    })

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected')
      setIsConnected(false)
    })

    newSocket.on('sensor_update', (data: SensorData) => {
      // Only update if data has actually changed
      const dataString = JSON.stringify(data)
      if (dataString !== lastUpdateRef.current) {
        lastUpdateRef.current = dataString
        setSensorData(data)
      }
    })

    return () => {
      newSocket.close()
    }
  }, [])

  const requestUpdate = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('request_update')
    }
  }, [isConnected])

  return {
    isConnected,
    sensorData,
    requestUpdate,
    isMotorRunning: sensorData.motor === 1,
    weight: sensorData.weight,
    distance: sensorData.distance,
    totalConsumedToday: sensorData.total_consumed_today
  }
}

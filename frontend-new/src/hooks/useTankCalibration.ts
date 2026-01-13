import { useState, useEffect } from 'react'
import { config } from '@/lib/config'

interface TankCalibration {
  min_distance: number
  max_distance: number
}

export function useTankCalibration() {
  const [calibration, setCalibration] = useState<TankCalibration>({
    min_distance: 30,  // Backend liefert mm, nicht cm!
    max_distance: 230   // Backend liefert mm, nicht cm!
  })

  useEffect(() => {
    const fetchCalibration = async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/tank/calibration`)
        if (res.ok) {
          const data = await res.json()
          setCalibration(data)
        }
      } catch (error) {
        console.error('Error fetching tank calibration:', error)
      }
    }

    fetchCalibration()
  }, [])

  return calibration
}

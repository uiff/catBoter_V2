import { Settings as SettingsIcon } from 'lucide-react'
import { SystemControl } from '@/components/settings/SystemControl'
import { TimeConfiguration } from '@/components/settings/TimeConfiguration'
import { SystemNotifications } from '@/components/settings/SystemNotifications'
import { WiFiConfiguration } from '@/components/settings/WiFiConfiguration'
import { LANConfiguration } from '@/components/settings/LANConfiguration'
import { SystemSettings } from '@/components/settings/SystemSettings'
import { WeightCalibration } from '@/components/settings/WeightCalibration'

export function Settings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Einstellungen</h1>
      </div>

      {/* System Settings */}
      <SystemSettings />

      {/* Sensor Calibration */}
      <WeightCalibration />

      {/* WiFi Configuration */}
      <WiFiConfiguration />

      {/* LAN Configuration */}
      <LANConfiguration />

      {/* System Notifications */}
      <SystemNotifications />

      {/* Time Configuration */}
      <TimeConfiguration />

      {/* System Control */}
      <SystemControl />
    </div>
  )
}

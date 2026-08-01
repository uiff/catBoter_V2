import { BrandLogo } from '@/components/layout/BrandLogo'
import { AppearanceCard } from './AppearanceCard'
import { NotificationsCard } from './NotificationsCard'
import { ScaleCard } from './ScaleCard'
import { TankCard } from './TankCard'
import { NetworkCard } from './NetworkCard'
import { ApFallbackCard } from './ApFallbackCard'
import { TimeCard } from './TimeCard'
import { SystemCard } from './SystemCard'

export default function SettingsPage() {
  return (
    <div className="space-y-3">
      <h1 className="px-1 text-lg font-semibold">System</h1>

      <AppearanceCard />
      <NotificationsCard />
      <ScaleCard />
      <TankCard />
      <NetworkCard />
      <ApFallbackCard />
      <TimeCard />
      <SystemCard />

      <div className="flex flex-col items-center gap-1.5 pb-2 pt-6">
        <BrandLogo className="h-3 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">powered by iotueli</p>
      </div>
    </div>
  )
}

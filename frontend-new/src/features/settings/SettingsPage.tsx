import { BrandLogo } from '@/components/layout/BrandLogo'
import { AppearanceCard } from './AppearanceCard'
import { NotificationsCard } from './NotificationsCard'
import { FeedingCard } from './FeedingCard'
import { DietCard } from './DietCard'
import { JitCard } from './JitCard'
import { CatProfileCard } from './CatProfileCard'
import { CareCard } from './CareCard'
import { ScaleCard } from './ScaleCard'
import { TankCard } from './TankCard'
import { NetworkCard } from './NetworkCard'
import { ApFallbackCard } from './ApFallbackCard'
import { IntegrationsCard } from './IntegrationsCard'
import { TimeCard } from './TimeCard'
import { SystemCard } from './SystemCard'
import { BackupCard } from './BackupCard'

export default function SettingsPage() {
  return (
    <div className="space-y-3">
      <h1 className="px-1 text-lg font-semibold">System</h1>

      <AppearanceCard />
      <NotificationsCard />
      <FeedingCard />
      <DietCard />
      <JitCard />
      <CatProfileCard />
      <CareCard />
      <ScaleCard />
      <TankCard />
      <NetworkCard />
      <ApFallbackCard />
      <IntegrationsCard />
      <TimeCard />
      <SystemCard />
      <BackupCard />

      <div className="flex flex-col items-center gap-1.5 pb-2 pt-6">
        <BrandLogo className="h-3 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">powered by iotueli</p>
      </div>
    </div>
  )
}

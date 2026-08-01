import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Header } from '@/components/layout/Header'
import { PwaUpdatePrompt } from '@/components/common/PwaUpdatePrompt'
import { TabBar } from '@/components/layout/TabBar'
import { ConnectionBanner } from '@/components/layout/ConnectionBanner'
import { Skeleton } from '@/components/ui/Misc'
import { useUiStore } from '@/stores/uiStore'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const PlansPage = lazy(() => import('@/features/plans/PlansPage'))
const StatsPage = lazy(() => import('@/features/stats/StatsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

function PageLoader() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export default function App() {
  const tab = useUiStore((s) => s.tab)
  const theme = useUiStore((s) => s.theme)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-dvh md:pl-[76px]">
        <Header />
        <ConnectionBanner />
        <main
          className="mx-auto max-w-3xl px-4 pt-4"
          style={{ paddingBottom: 'calc(var(--tabbar-h) + 20px + env(safe-area-inset-bottom))' }}
        >
          <Suspense fallback={<PageLoader />}>
            {tab === 'dashboard' && <DashboardPage />}
            {tab === 'plans' && <PlansPage />}
            {tab === 'stats' && <StatsPage />}
            {tab === 'settings' && <SettingsPage />}
          </Suspense>
        </main>
        <TabBar />
      </div>
      <Toaster
        position="top-center"
        theme={theme === 'system' ? 'system' : theme}
        toastOptions={{ duration: 3000 }}
      />
      <PwaUpdatePrompt />
    </QueryClientProvider>
  )
}

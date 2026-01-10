import { useState, lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { PWAInstallBanner } from './components/common/PWAInstallBanner'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { useSensorData } from './hooks/useSensorData'

// Lazy load pages for better code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const FeedControl = lazy(() => import('./pages/FeedControl').then(m => ({ default: m.FeedControl })))
const Monitoring = lazy(() => import('./pages/Monitoring').then(m => ({ default: m.Monitoring })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="glass rounded-xl p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Lädt...</p>
      </div>
    </div>
  </div>
)

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isConnected } = useSensorData()

  const pageTitle = {
    dashboard: 'Übersicht',
    feed: 'Fütterung',
    monitor: 'Monitoring',
    settings: 'Einstellungen',
  }[currentPage] || 'Übersicht'

  const handleNavigate = (page: string) => {
    setCurrentPage(page)
    setSidebarOpen(false) // Close sidebar on mobile after navigation
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background overflow-hidden">
        <Toaster
          position="top-right"
          richColors
          closeButton
          theme="dark"
        />

        {/* PWA Install Banner */}
        <PWAInstallBanner />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title={pageTitle}
          isConnected={isConnected}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={<PageLoader />}>
            {currentPage === 'dashboard' && <Dashboard />}
            {currentPage === 'feed' && <FeedControl />}
            {currentPage === 'monitor' && <Monitoring />}
            {currentPage === 'settings' && <Settings />}
          </Suspense>
        </main>
      </div>
    </div>
    </ErrorBoundary>
  )
}

export default App

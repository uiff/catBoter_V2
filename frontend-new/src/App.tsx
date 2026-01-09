import { useState } from 'react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { PWAInstallBanner } from './components/common/PWAInstallBanner'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './pages/Dashboard'
import { FeedControl } from './pages/FeedControl'
import { Monitoring } from './pages/Monitoring'
import { Settings } from './pages/Settings'
import { useSensorData } from './hooks/useSensorData'

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
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'feed' && <FeedControl />}
          {currentPage === 'monitor' && <Monitoring />}
          {currentPage === 'settings' && <Settings />}
        </main>
      </div>
    </div>
    </ErrorBoundary>
  )
}

export default App

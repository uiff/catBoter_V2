import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { initUiBindings } from '@/stores/uiStore'
import { connectSocket } from '@/stores/socketStore'
import './index.css'

initUiBindings()
connectSocket()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

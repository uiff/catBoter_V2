import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: any
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error Boundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo
    })

    // Log error to backend or external service
    this.logErrorToService(error, errorInfo)
  }

  logErrorToService = (error: Error, errorInfo: any) => {
    // Could send to backend logging endpoint
    console.error('Logging error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })

    // Reload the page as a last resort
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="glass rounded-xl p-8 max-w-2xl w-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Etwas ist schiefgelaufen</h1>
                <p className="text-muted-foreground">
                  Die Anwendung ist auf einen unerwarteten Fehler gestoßen
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-6 p-4 bg-background/50 rounded-lg border border-border">
                <p className="text-sm font-mono text-destructive mb-2">
                  {this.state.error.message}
                </p>
                {import.meta.env.DEV && this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-sm text-muted-foreground cursor-pointer">
                      Stack Trace anzeigen
                    </summary>
                    <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-64">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-lg transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                Seite neu laden
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 glass glass-hover font-semibold py-3 px-6 rounded-lg transition-all"
              >
                Zur Startseite
              </button>
            </div>

            <p className="mt-6 text-sm text-muted-foreground text-center">
              Wenn das Problem weiterhin besteht, kontaktiere den Support
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

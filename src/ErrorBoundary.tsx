import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Lumen ErrorBoundary caught an unhandled exception:', error, errorInfo)
  }

  handleReload = (): void => {
    try {
      window.sessionStorage.removeItem('lumen.splash-done')
      window.sessionStorage.removeItem('omdb.apple-tv-style.active-screen')
    } catch {
      // ignore
    }
    window.location.reload()
  }

  handleResetToLogin = (): void => {
    try {
      window.sessionStorage.clear()
      window.localStorage.removeItem('omdb.apple-tv-style.current-user')
      window.location.hash = '#login'
    } catch {
      // ignore
    }
    window.location.reload()
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <main
          style={{
            minHeight: '100vh',
            width: '100vw',
            backgroundColor: '#0a0a0c',
            color: '#f5f5f7',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '440px',
              width: '100%',
              backgroundColor: '#16161a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '32px 24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 69, 58, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff453a',
                fontSize: '24px',
              }}
            >
              ⚠️
            </div>

            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#fff' }}>
              Something went wrong
            </h1>

            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.65)', margin: 0, lineHeight: 1.5 }}>
              Lumen encountered an unexpected error while loading the screen.
            </p>

            {this.state.error?.message && (
              <pre
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  color: '#ff8080',
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  textAlign: 'left',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  margin: '4px 0',
                  boxSizing: 'border-box',
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  height: '46px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#0071e3',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease',
                }}
              >
                Reload App
              </button>

              <button
                type="button"
                onClick={this.handleResetToLogin}
                style={{
                  flex: 1,
                  height: '46px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign In Screen
              </button>
            </div>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}

import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import {
  closeInSiteDownload,
  subscribeDownloadModal,
  type InSiteDownloadRequest,
} from './downloads'

/**
 * In-site download modal that keeps the 02moviedownloader flow embedded inside
 * Lumen instead of navigating away or opening a new browser tab.
 */
export function DownloadEmbedModal() {
  const [request, setRequest] = useState<InSiteDownloadRequest | null>(null)
  const [isFrameLoading, setIsFrameLoading] = useState(true)
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    return subscribeDownloadModal((next) => {
      setRequest(next)
      if (next) {
        setIsFrameLoading(true)
        setReloadNonce((prev) => prev + 1)
      }
    })
  }, [])

  useEffect(() => {
    if (!request || typeof window === 'undefined') return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeInSiteDownload()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [request])

  if (!request) return null

  return (
    <div
      className="download-embed-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={request.title ? `Download ${request.title}` : 'Download Video'}
    >
      <div
        className="download-embed-backdrop"
        onClick={closeInSiteDownload}
        aria-hidden="true"
      />

      <div className="download-embed-card">
        <header className="download-embed-header">
          <div className="download-embed-title-group">
            {request.poster ? (
              <img
                src={request.poster}
                alt={request.title || 'Media poster'}
                className="download-embed-poster"
              />
            ) : (
              <div className="download-embed-icon-bubble" aria-hidden="true">
                <Download size={18} />
              </div>
            )}
            <div className="download-embed-meta">
              <h3>{request.title || 'Download Media'}</h3>
              <p>{request.subtitle || 'Download directly inside Lumen'}</p>
            </div>
          </div>

          <div className="download-embed-header-actions">
            <button
              type="button"
              className="download-embed-icon-btn"
              title="Reload download panel"
              aria-label="Reload download panel"
              onClick={() => {
                setIsFrameLoading(true)
                setReloadNonce((prev) => prev + 1)
              }}
            >
              <RefreshCw size={16} className={isFrameLoading ? 'spin' : undefined} />
            </button>
            <button
              type="button"
              className="download-embed-icon-btn close-btn"
              title="Close download"
              aria-label="Close download"
              onClick={closeInSiteDownload}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="download-embed-frame-wrap">
          {isFrameLoading && (
            <div className="download-embed-loading" aria-live="polite">
              <RefreshCw size={26} className="spin" />
              <span>Preparing download inside Lumen...</span>
            </div>
          )}
          <iframe
            key={`${request.url}-${reloadNonce}`}
            src={request.url}
            title={request.title ? `Download ${request.title}` : 'Lumen Download'}
            className="download-embed-iframe"
            allow="autoplay; fullscreen; encrypted-media; clipboard-write"
            allowFullScreen
            onLoad={() => setIsFrameLoading(false)}
          />
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import {
  X,
  Download,
  Server,
  Sliders,
  Check,
  Sparkles,
  WifiOff,
  Clock,
  HardDrive,
} from 'lucide-react'
import { formatBytes, estimateMediaSize } from './downloads'
import type { Movie } from './omdb'

export interface DownloadOptionsModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (server: string, quality: string) => void
  movie: Partial<Movie>
  season?: number
  episode?: number
  episodeTitle?: string
  currentServer?: string
  currentQuality?: string
  isRedownload?: boolean
}

export type QualityOption = {
  id: string
  label: string
  resolution: string
  desc: string
  badge?: string
}

export type ServerOption = {
  id: string
  name: string
  badge: string
  description: string
  recommended?: boolean
}

const QUALITY_OPTIONS: QualityOption[] = [
  {
    id: '1080p',
    label: '1080p',
    resolution: 'Full HD',
    desc: 'Crisp image, best on desktop and TV screens',
    badge: 'Popular',
  },
  {
    id: '720p',
    label: '720p',
    resolution: 'HD',
    desc: 'Fast download, balanced for laptops & tablets',
  },
  {
    id: '480p',
    label: '480p',
    resolution: 'SD',
    desc: 'Compact size, data saver for mobile storage',
  },
  {
    id: 'auto',
    label: 'Auto',
    resolution: 'Source',
    desc: 'Original source stream bitrate directly from provider',
  },
]

const MOVIE_SERVERS: ServerOption[] = [
  {
    id: 'auto',
    name: 'Auto-Resolve',
    badge: '⚡ Recommended',
    description: 'Probes all scrapers for direct stream with auto-fallback',
    recommended: true,
  },
  {
    id: 'vidking',
    name: 'Vidking',
    badge: 'Fast HD',
    description: 'Cloudflare-protected HD stream with multi-audio & subs',
  },
  {
    id: 'rivestream',
    name: 'Rivestream',
    badge: 'Multi-CDN',
    description: 'Fast distributed multi-CDN embed player',
  },
  {
    id: 'cinesrc',
    name: 'CineSrc',
    badge: '1080p',
    description: 'High-speed movies & TV series stream provider',
  },
  {
    id: 'embedapi',
    name: 'EmbedAPI',
    badge: 'Direct Stream',
    description: 'Direct video scraper with multiple origins',
  },
  {
    id: 'primesrc',
    name: 'PrimeSrc',
    badge: 'Mirror',
    description: 'Clean high-availability backup stream',
  },
  {
    id: 'vidrift',
    name: 'VidRift',
    badge: 'Direct',
    description: 'Fast direct video host for movies and shows',
  },
  {
    id: 'superembed',
    name: 'SuperEmbed VIP',
    badge: 'Multi-Server',
    description: 'Multi-source resolver aggregator',
  },
]

const ANIME_SERVERS: ServerOption[] = [
  {
    id: 'auto',
    name: 'Auto-Resolve',
    badge: '⚡ Recommended',
    description: 'Automatically picks fastest direct anime stream',
    recommended: true,
  },
  {
    id: 'anikoto',
    name: 'Anikoto API',
    badge: '1080p Direct',
    description: 'Direct anime episode stream scraper',
  },
  {
    id: 'megaplay',
    name: 'MegaPlay',
    badge: 'Sub & Dub',
    description: 'AniList-native fast streaming server',
  },
  {
    id: 'megabuzz',
    name: 'MegaBuzz',
    badge: 'High Speed',
    description: 'Direct anime streaming mirror',
  },
]

export function DownloadOptionsModal({
  isOpen,
  onClose,
  onConfirm,
  movie,
  season,
  episode,
  episodeTitle,
  currentServer = 'auto',
  currentQuality = '1080p',
  isRedownload = false,
}: DownloadOptionsModalProps) {
  const [selectedServer, setSelectedServer] = useState<string>(currentServer || 'auto')
  const [selectedQuality, setSelectedQuality] = useState<string>(currentQuality || '1080p')

  if (!isOpen) return null

  const isAnime = Boolean(movie.isAnime)
  const availableServers = isAnime ? ANIME_SERVERS : MOVIE_SERVERS
  const activeServerObj = availableServers.find((s) => s.id === selectedServer) || availableServers[0]

  const estimatedBytes = estimateMediaSize(
    movie.runtime,
    isAnime ? 'anime' : (movie.type === 'series' || season ? 'tv' : 'movie'),
    selectedQuality,
  )

  const handleStart = () => {
    onConfirm(selectedServer, selectedQuality)
    onClose()
  }

  return (
    <div className="download-options-modal-overlay">
      <div className="download-options-backdrop" onClick={onClose} />
      <div className="download-options-card">
        {/* Header */}
        <div className="download-options-header">
          <div className="download-options-title-box">
            <div className="download-options-icon-bubble">
              <Sliders size={18} />
            </div>
            <div>
              <h3>{isRedownload ? 'Change Server & Quality' : 'Download Options'}</h3>
              <p>Configure streaming server and resolution for offline storage</p>
            </div>
          </div>
          <button
            type="button"
            className="download-options-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Media Preview Box */}
        <div className="download-media-preview-box">
          <div
            className="download-preview-thumb"
            style={{ backgroundImage: `url(${movie.poster || movie.still || '/login-bg.jpeg'})` }}
          />
          <div className="download-preview-meta">
            <h4>{movie.title || 'Unknown Title'}</h4>
            <div className="download-preview-tags">
              {season && episode && (
                <span className="preview-badge highlight">
                  Season {season} Episode {episode}
                </span>
              )}
              {episodeTitle && <span className="preview-badge">{episodeTitle}</span>}
              {movie.year && <span className="preview-badge">{movie.year}</span>}
              {movie.runtime && (
                <span className="preview-badge">
                  <Clock size={11} style={{ marginRight: '3px' }} />
                  {movie.runtime}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Server Selection */}
        <div className="download-section">
          <div className="download-section-header">
            <div className="section-label">
              <Server size={15} />
              <span>Select Server / Provider</span>
            </div>
            <span className="section-hint">Choose another server if current one is blocked</span>
          </div>

          <div className="download-server-grid">
            {availableServers.map((srv) => {
              const isSelected = selectedServer === srv.id
              return (
                <div
                  key={srv.id}
                  className={`download-server-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedServer(srv.id)}
                >
                  <div className="server-card-top">
                    <span className="server-card-name">{srv.name}</span>
                    <span className={`server-card-badge ${srv.recommended ? 'rec' : ''}`}>
                      {srv.badge}
                    </span>
                  </div>
                  <p className="server-card-desc">{srv.description}</p>
                  {isSelected && (
                    <div className="server-selected-check">
                      <Check size={13} strokeWidth={3} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Quality Selection */}
        <div className="download-section">
          <div className="download-section-header">
            <div className="section-label">
              <Sparkles size={15} />
              <span>Select Quality</span>
            </div>
            <span className="section-hint">Est. file size: {formatBytes(estimatedBytes)}</span>
          </div>

          <div className="download-quality-row">
            {QUALITY_OPTIONS.map((q) => {
              const isSelected = selectedQuality === q.id
              return (
                <div
                  key={q.id}
                  className={`download-quality-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedQuality(q.id)}
                >
                  <div className="quality-chip-header">
                    <span className="quality-chip-label">{q.label}</span>
                    {q.badge && <span className="quality-chip-badge">{q.badge}</span>}
                  </div>
                  <span className="quality-chip-res">{q.resolution}</span>
                  {isSelected && (
                    <div className="quality-check-dot">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Storage Summary & Disclaimer */}
        <div className="download-storage-summary">
          <div className="storage-info-item">
            <HardDrive size={15} className="storage-icon" />
            <div>
              <span className="storage-title">Storage Required</span>
              <span className="storage-value">~{formatBytes(estimatedBytes)}</span>
            </div>
          </div>
          <div className="storage-info-divider" />
          <div className="storage-info-item">
            <WifiOff size={15} className="storage-icon green" />
            <div>
              <span className="storage-title">Playback Mode</span>
              <span className="storage-value green">Offline File & HD Stream</span>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="download-options-footer">
          <button type="button" className="btn-options-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-options-download" onClick={handleStart}>
            <Download size={16} />
            <span>
              {isRedownload ? 'Re-download with ' : 'Download with '}
              {activeServerObj.name} ({selectedQuality.toUpperCase()})
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

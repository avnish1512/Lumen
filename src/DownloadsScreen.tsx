import React, { useState, useEffect, useRef } from 'react'
import {
  Download,
  Play,
  Trash2,
  HardDrive,
  Film,
  Tv,
  CheckCircle2,
  X,
  Share2,
  Clock,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  WifiOff,
  Sliders,
  AlertCircle,
} from 'lucide-react'
import {
  type DownloadItem,
  getAllDownloads,
  deleteDownload,
  subscribeDownloads,
  getDownloadBlob,
  exportToDevice,
  formatBytes,
  getTotalStorageUsed,
  redownloadItem,
} from './downloads'
import { buildStreamUrl, type StreamProvider, isStreamProvider } from './tmdb'
import type { Movie } from './omdb'
import { normalizeMovie } from './omdb'
import { DownloadOptionsModal } from './DownloadOptionsModal'

interface DownloadsScreenProps {
  onBack?: () => void
  onExplore?: () => void
  onPlayMovie?: (item: DownloadItem) => void
  onOpenDetail?: (item: DownloadItem) => void
  designMode?: 'apple' | 'netflix'
}

function downloadItemToMovie(item: DownloadItem): Movie {
  const numericTmdbId =
    typeof item.tmdbId === 'number'
      ? item.tmdbId
      : item.tmdbId
        ? parseInt(String(item.tmdbId), 10)
        : undefined

  return normalizeMovie({
    id: item.movieId || item.id,
    title: item.title,
    year: item.year || '',
    poster: item.poster || '',
    still: item.still || item.poster || '',
    hero: item.still || item.poster || '',
    runtime: item.runtime || '',
    type: item.mediaType === 'tv' ? 'series' : item.mediaType === 'anime' ? 'anime' : 'movie',
    isAnime: item.mediaType === 'anime',
    genres: item.mediaType === 'anime' ? ['Anime'] : [],
    tmdbId: numericTmdbId,
    tmdbType: item.mediaType === 'tv' ? 'tv' : 'movie',
    streamSeason: item.season,
    streamEpisode: item.episode,
    trailerYoutubeId: item.trailerYoutubeId,
  })
}

function getStreamEmbedUrlForItem(item: DownloadItem): string {
  if (item.trailerYoutubeId) {
    return `https://www.youtube-nocookie.com/embed/${item.trailerYoutubeId}?autoplay=1&enablejsapi=1`
  }
  if (item.directUrl && (item.directUrl.startsWith('http://') || item.directUrl.startsWith('https://')) && !item.directUrl.includes('/api/stream-proxy')) {
    return item.directUrl
  }
  const movie = downloadItemToMovie(item)
  const provider = item.server && isStreamProvider(item.server) ? (item.server as StreamProvider) : 'vidking'
  const url = buildStreamUrl(movie, provider)
  return url || `https://www.vidking.net/embed/movie/${movie.tmdbId || item.id}?color=e50914&autoPlay=true`
}

export function DownloadsScreen({
  onBack,
  onExplore,
  onPlayMovie,
  onOpenDetail: _onOpenDetail,
  designMode = 'apple',
}: DownloadsScreenProps) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [storageUsed, setStorageUsed] = useState<string>('0 MB')
  const [activePlayItem, setActivePlayItem] = useState<DownloadItem | null>(null)
  const [offlineVideoUrl, setOfflineVideoUrl] = useState<string | null>(null)
  const [streamEmbedUrl, setStreamEmbedUrl] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv' | 'anime'>('all')
  const [configuredItem, setConfiguredItem] = useState<DownloadItem | null>(null)
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null)

  const handleRedownloadConfirm = async (server: string, quality: string) => {
    if (!configuredItem) return
    const target = configuredItem
    setConfiguredItem(null)
    if (activePlayItem?.id === target.id) {
      handleClosePlayer()
    }
    await redownloadItem(target, { server, quality })
  }

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      const all = await getAllDownloads()
      const storage = await getTotalStorageUsed()
      if (isMounted) {
        setDownloads(all)
        setStorageUsed(storage.formatted)
      }
    }
    void load()

    const unsubscribe = subscribeDownloads((updated) => {
      if (isMounted) {
        setDownloads(updated)
        void getTotalStorageUsed().then((st) => setStorageUsed(st.formatted))
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // Handle playing video in popup modal (100% offline from device storage or full stream)
  const handlePlayOffline = async (item: DownloadItem) => {
    setActivePlayItem(item)
    const blob = await getDownloadBlob(item.id)
    if (blob && blob.size > 200_000 && !item.isFallback) {
      const url = URL.createObjectURL(blob)
      setOfflineVideoUrl(url)
      setStreamEmbedUrl(null)
    } else {
      if (offlineVideoUrl && offlineVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(offlineVideoUrl)
      }
      setOfflineVideoUrl(null)
      const embedUrl = getStreamEmbedUrlForItem(item)
      setStreamEmbedUrl(embedUrl)
    }
  }

  const handleClosePlayer = () => {
    if (offlineVideoUrl && offlineVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(offlineVideoUrl)
    }
    setOfflineVideoUrl(null)
    setStreamEmbedUrl(null)
    setActivePlayItem(null)
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (activePlayItem?.id === id) {
      handleClosePlayer()
    }
    await deleteDownload(id)
  }

  const handleExport = async (item: DownloadItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setIsExporting(item.id)
    try {
      await exportToDevice(item.id, item.title)
    } finally {
      setTimeout(() => setIsExporting(null), 1000)
    }
  }

  const completedDownloads = downloads.filter((d) => d.status === 'completed')
  const inProgressDownloads = downloads.filter((d) => d.status === 'downloading' || d.status === 'paused' || d.status === 'error')

  const filteredDownloads = completedDownloads.filter((d) => {
    if (filterType === 'all') return true
    return d.mediaType === filterType
  })

  const isNetflix = designMode === 'netflix'

  return (
    <section className={`screen downloads-screen ${isNetflix ? 'netflix-downloads-theme' : 'apple-downloads-theme'}`}>
      {/* Header */}
      <header className="downloads-header">
        <div className="downloads-header-left">
          {onBack && (
            <button className="back-btn circle-action" type="button" onClick={onBack} title="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="downloads-title">
              <Download className="title-icon" size={24} />
              <span>Downloads</span>
            </h1>
            <p className="downloads-subtitle">Downloaded movies and shows stored locally for 100% offline playback</p>
          </div>
        </div>

        {completedDownloads.length > 0 && (
          <div className="downloads-storage-pill">
            <HardDrive size={15} />
            <span>{storageUsed} on device</span>
          </div>
        )}
      </header>

      {/* Storage & Filter Bar */}
      {completedDownloads.length > 0 && (
        <div className="downloads-filter-bar">
          <div className="downloads-filter-buttons">
            <button
              className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
              type="button"
              onClick={() => setFilterType('all')}
            >
              All ({completedDownloads.length})
            </button>
            <button
              className={`filter-btn ${filterType === 'movie' ? 'active' : ''}`}
              type="button"
              onClick={() => setFilterType('movie')}
            >
              <Film size={14} />
              <span>Movies</span>
            </button>
            <button
              className={`filter-btn ${filterType === 'tv' ? 'active' : ''}`}
              type="button"
              onClick={() => setFilterType('tv')}
            >
              <Tv size={14} />
              <span>TV Shows</span>
            </button>
            <button
              className={`filter-btn ${filterType === 'anime' ? 'active' : ''}`}
              type="button"
              onClick={() => setFilterType('anime')}
            >
              <Sparkles size={14} />
              <span>Anime</span>
            </button>
          </div>
        </div>
      )}

      {/* In-Progress Downloads Queue */}
      {inProgressDownloads.length > 0 && (
        <section className="downloads-queue-section">
          <h2 className="section-title">
            <RefreshCw className="spin" size={16} />
            <span>Downloading to Device ({inProgressDownloads.length})</span>
          </h2>
          <div className="downloads-queue-list">
            {inProgressDownloads.map((item) => (
              <div key={item.id} className="download-queue-card">
                <div
                  className="queue-card-poster"
                  style={{ backgroundImage: `url(${item.poster || item.still || '/login-bg.jpeg'})` }}
                />
                <div className="queue-card-info">
                  <div className="queue-card-header">
                    <h4>{item.title}</h4>
                    <span className={`status-tag ${item.status}`}>
                      {item.status === 'downloading' && `${item.progress}%`}
                      {item.status === 'paused' && 'Paused'}
                      {item.status === 'error' && 'Failed'}
                    </span>
                  </div>
                  {item.episodeTitle && <p className="queue-episode-text">{item.episodeTitle}</p>}
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${item.progress}%` }} />
                  </div>
                  <div className="queue-card-meta">
                    <span>
                      {formatBytes(item.downloadedBytes || Math.round((item.progress / 100) * item.totalBytes))} / {formatBytes(item.totalBytes)}
                    </span>
                    <button
                      className="queue-cancel-btn"
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Cancel download"
                    >
                      <X size={14} />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completed Downloads Grid */}
      {filteredDownloads.length > 0 ? (
        <section className="downloads-grid-section">
          <h2 className="section-title">
            <CheckCircle2 size={16} />
            <span>Ready for Offline Playback</span>
          </h2>
          <div className="downloads-cards-grid">
            {filteredDownloads.map((item) => (
              <div
                key={item.id}
                className="download-media-card"
                onClick={() => handlePlayOffline(item)}
              >
                <div className="download-poster-wrapper">
                  <img
                    src={item.poster || item.still || '/login-bg.jpeg'}
                    alt={item.title}
                    className="download-poster-img"
                    loading="lazy"
                  />
                  <div className="download-play-overlay">
                    <button
                      className="play-overlay-btn"
                      type="button"
                      aria-label="Play Offline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePlayOffline(item)
                      }}
                    >
                      <Play fill="currentColor" strokeWidth={0} size={24} />
                    </button>
                  </div>
                  {item.isFallback ? (
                    <span className="download-badge-offline stream-ready-badge">
                      <Sparkles size={11} style={{ marginRight: '3px' }} />
                      Stream Ready
                    </span>
                  ) : (
                    <span className="download-badge-offline">
                      <ShieldCheck size={11} style={{ marginRight: '3px' }} />
                      Offline Ready
                    </span>
                  )}
                </div>

                <div className="download-details">
                  <h3 className="download-card-title" title={item.title}>
                    {item.title}
                  </h3>
                  {item.episodeTitle && <p className="download-episode-title">{item.episodeTitle}</p>}
                  
                  <div className="download-meta-row">
                    {item.year && <span className="meta-tag">{item.year}</span>}
                    {item.runtime && (
                      <span className="meta-tag">
                        <Clock size={11} /> {item.runtime}
                      </span>
                    )}
                    {item.quality && <span className="meta-tag quality-tag">{item.quality.toUpperCase()}</span>}
                    {item.server && <span className="meta-tag server-tag">{item.server.toUpperCase()}</span>}
                    <span className="meta-tag size-tag">
                      {item.isFallback ? 'Full Stream' : formatBytes(item.totalBytes || item.downloadedBytes)}
                    </span>
                  </div>

                  <div className="download-actions-row">
                    <button
                      className="btn-offline-play"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePlayOffline(item)
                      }}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>{item.isFallback ? 'Watch Stream' : 'Play Offline'}</span>
                    </button>

                    <button
                      className="btn-download-action"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfiguredItem(item)
                      }}
                      title="Change Server / Quality"
                    >
                      <Sliders size={13} />
                      <span>Server</span>
                    </button>

                    <button
                      className="btn-download-action"
                      type="button"
                      onClick={(e) => handleExport(item, e)}
                      title="Save as MP4 / Export"
                      disabled={isExporting === item.id}
                    >
                      <Share2 size={14} />
                      <span>{isExporting === item.id ? 'Saving...' : 'Export'}</span>
                    </button>

                    <button
                      className="btn-download-action delete-btn"
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Delete Download"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : inProgressDownloads.length === 0 ? (
        /* Empty State */
        <div className="downloads-empty-state">
          <div className="empty-icon-circle">
            <Download size={42} />
          </div>
          <h2>No Downloads Yet</h2>
          <p>
            Download movies and TV shows to watch anytime on planes, trains, and anywhere without Wi-Fi.
          </p>
          {onExplore && (
            <button className="primary-play small" type="button" onClick={onExplore}>
              <Film size={16} />
              <span>Browse Movies to Download</span>
            </button>
          )}
        </div>
      ) : null}

      {/* 100% Offline HTML5 Video Player Modal */}
      {activePlayItem && (
        <div className="offline-player-modal">
          <div className="offline-player-backdrop" onClick={handleClosePlayer} />
          <div className="offline-player-container">
            <header className="offline-player-header">
              <div className="offline-player-title">
                {streamEmbedUrl ? (
                  <span className="offline-indicator online-indicator">
                    <Play size={13} style={{ marginRight: '4px' }} />
                    Full Stream ({activePlayItem.server?.toUpperCase() || 'ONLINE'})
                  </span>
                ) : (
                  <span className="offline-indicator">
                    <WifiOff size={13} style={{ marginRight: '4px' }} />
                    Offline Storage Playback
                  </span>
                )}
                <h3>{activePlayItem.title}</h3>
                {activePlayItem.episodeTitle && <p>{activePlayItem.episodeTitle}</p>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn-download-action"
                  type="button"
                  onClick={() => setConfiguredItem(activePlayItem)}
                  title="Change Server / Quality"
                >
                  <Sliders size={14} />
                  <span>Change Server</span>
                </button>

                <button
                  className="btn-download-action"
                  type="button"
                  onClick={() => handleExport(activePlayItem)}
                  title="Export MP4 to device"
                  disabled={isExporting === activePlayItem.id}
                >
                  <Share2 size={14} />
                  <span>{isExporting === activePlayItem.id ? 'Exporting...' : 'Export MP4'}</span>
                </button>

                {onPlayMovie && (
                  <button
                    className="btn-download-action"
                    type="button"
                    onClick={() => {
                      handleClosePlayer()
                      onPlayMovie(activePlayItem)
                    }}
                    title="Switch to Online Watch Server"
                  >
                    <ExternalLink size={14} />
                    <span>Stream Online</span>
                  </button>
                )}

                <button
                  className="offline-player-close"
                  type="button"
                  onClick={handleClosePlayer}
                  title="Close Player"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            {streamEmbedUrl && (
              <div className="offline-fallback-notice online-stream-notice">
                <AlertCircle size={15} />
                <span>
                  Streaming <strong>{activePlayItem.title}</strong> in Full HD ({activePlayItem.server?.toUpperCase() || 'default server'}). Cloudflare Turnstile anti-bot prevents raw file caching on this host, so the full movie is ready to stream online.
                </span>
                <button type="button" onClick={() => setConfiguredItem(activePlayItem)}>
                  Change Server
                </button>
              </div>
            )}

            <div className="offline-video-wrapper">
              {streamEmbedUrl ? (
                <iframe
                  src={streamEmbedUrl}
                  className="offline-stream-iframe"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                  title={activePlayItem.title}
                />
              ) : offlineVideoUrl ? (
                <video
                  ref={videoPlayerRef}
                  className="offline-video-element"
                  src={offlineVideoUrl}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <div className="offline-video-error">
                  <RefreshCw className="spin" size={32} />
                  <p>Connecting to video stream...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Download Options / Change Server Modal */}
      {configuredItem && (
        <DownloadOptionsModal
          isOpen={Boolean(configuredItem)}
          onClose={() => setConfiguredItem(null)}
          onConfirm={handleRedownloadConfirm}
          movie={{
            title: configuredItem.title,
            poster: configuredItem.poster,
            still: configuredItem.still,
            runtime: configuredItem.runtime,
            year: configuredItem.year,
            type: configuredItem.mediaType === 'tv' ? 'series' : 'movie',
            isAnime: configuredItem.mediaType === 'anime',
          }}
          season={configuredItem.season}
          episode={configuredItem.episode}
          episodeTitle={configuredItem.episodeTitle}
          currentServer={configuredItem.server}
          currentQuality={configuredItem.quality}
          isRedownload={true}
        />
      )}
    </section>
  )
}

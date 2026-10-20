// Native HLS video frame powered by hls.js (https://github.com/video-dev/hls.js).
//
// Plays a direct HLS (.m3u8) stream inside a real <video> element:
//   - Uses hls.js (Media Source Extensions) where it is supported.
//   - Falls back to the browser's built-in HLS support on Safari / iOS, which
//     can play .m3u8 straight from the `src` attribute.
//   - Recovers automatically from transient network / media errors.
//
// This is the building block for direct-stream playback. Embed-style providers
// (which hand back an iframe player rather than a raw .m3u8) still use the
// iframe path in the watch screen.

import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'

export type HlsPlayerProps = {
  /** Direct HLS manifest URL (…/master.m3u8). */
  src: string
  className?: string
  poster?: string
  autoPlay?: boolean
  muted?: boolean
  controls?: boolean
  title?: string
  /** Playback position in seconds to resume from. */
  startTime?: number
  /** Fired once playback actually begins (useful for "continue watching"). */
  onPlay?: () => void
  /** Fired periodically during playback with current position and total duration. */
  onTimeUpdate?: (currentTime: number, duration: number) => void
  /** Fired when playback pauses. */
  onPause?: (currentTime: number, duration: number) => void
  /** Fired when playback finishes. */
  onEnded?: () => void
  /** Fired when the stream can't be loaded / recovered. */
  onError?: (message: string) => void
}

export function HlsPlayer({
  src,
  className,
  poster,
  autoPlay = true,
  muted = false,
  controls = true,
  title,
  startTime = 0,
  onPlay,
  onTimeUpdate,
  onPause,
  onEnded,
  onError,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const hasSeekedInitialRef = useRef(false)

  useEffect(() => {
    hasSeekedInitialRef.current = false
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) {
      return
    }

    setFatal(null)

    const applyStartTime = () => {
      if (!hasSeekedInitialRef.current && startTime > 0 && Number.isFinite(video.duration)) {
        if (startTime < video.duration) {
          video.currentTime = startTime
          hasSeekedInitialRef.current = true
        }
      }
    }

    const fail = (message: string) => {
      setFatal(message)
      onError?.(message)
    }

    // Safari / iOS play HLS natively — no hls.js needed there.
    const canPlayNative = video.canPlayType('application/vnd.apple.mpegurl')

    if (!Hls.isSupported()) {
      if (canPlayNative) {
        video.src = src
        video.addEventListener('loadedmetadata', applyStartTime, { once: true })
        video.addEventListener('canplay', applyStartTime, { once: true })
        return () => {
          video.removeEventListener('loadedmetadata', applyStartTime)
          video.removeEventListener('canplay', applyStartTime)
          video.removeAttribute('src')
          video.load()
        }
      }

      fail('This browser cannot play HLS streams.')
      return
    }

    const hls = new Hls({
      // Lower latency start and resilient buffering for flaky sources.
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
    })

    hls.loadSource(src)
    hls.attachMedia(video)

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      applyStartTime()
    })

    video.addEventListener('loadedmetadata', applyStartTime, { once: true })
    video.addEventListener('canplay', applyStartTime, { once: true })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        return
      }

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad()
          break
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError()
          break
        default:
          hls.destroy()
          fail('Playback failed. The stream may be offline.')
          break
      }
    })

    return () => {
      video.removeEventListener('loadedmetadata', applyStartTime)
      video.removeEventListener('canplay', applyStartTime)
      hls.destroy()
    }
  }, [src, startTime, onError])

  return (
    <div className={className}>
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        controls={controls}
        playsInline
        title={title}
        onPlay={onPlay}
        onTimeUpdate={() => {
          const v = videoRef.current
          if (v && Number.isFinite(v.currentTime) && Number.isFinite(v.duration)) {
            onTimeUpdate?.(v.currentTime, v.duration)
          }
        }}
        onPause={() => {
          const v = videoRef.current
          if (v && Number.isFinite(v.currentTime) && Number.isFinite(v.duration)) {
            onPause?.(v.currentTime, v.duration)
          }
        }}
        onEnded={onEnded}
        style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
      />
      {fatal && (
        <p className="hls-player-error" role="alert">
          {fatal}
        </p>
      )}
    </div>
  )
}

export default HlsPlayer

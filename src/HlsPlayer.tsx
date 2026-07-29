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
  /** Fired once playback actually begins (useful for "continue watching"). */
  onPlay?: () => void
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
  onPlay,
  onError,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) {
      return
    }

    setFatal(null)

    const fail = (message: string) => {
      setFatal(message)
      onError?.(message)
    }

    // Safari / iOS play HLS natively — no hls.js needed there.
    const canPlayNative = video.canPlayType('application/vnd.apple.mpegurl')

    if (!Hls.isSupported()) {
      if (canPlayNative) {
        video.src = src
        return () => {
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
      hls.destroy()
    }
  }, [src, onError])

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

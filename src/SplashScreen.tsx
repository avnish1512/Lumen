import { useCallback, useEffect, useRef, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onFinish?: () => void
  durationMs?: number
}

export function SplashScreen({ onFinish, durationMs = 3000 }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false)
  const [hidden, setHidden] = useState(false)
  const finishCalledRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const triggerFinish = useCallback(() => {
    if (finishCalledRef.current) return
    finishCalledRef.current = true
    setHidden(true)
    if (onFinish) {
      onFinish()
    }
  }, [onFinish])

  const startFadeOut = useCallback(() => {
    setFadingOut(true)
    setTimeout(triggerFinish, 500)
  }, [triggerFinish])

  useEffect(() => {
    if (videoRef.current && typeof videoRef.current.play === 'function') {
      videoRef.current.muted = true
      try {
        const playPromise = videoRef.current.play()
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Autoplay may be deferred; timer will handle transition
          })
        }
      } catch {
        // Ignore playback errors
      }
    }

    const timer = setTimeout(() => {
      startFadeOut()
    }, durationMs)

    return () => clearTimeout(timer)
  }, [durationMs, startFadeOut])

  if (hidden) {
    return null
  }

  return (
    <div
      className={`lumen-splash-overlay${fadingOut ? ' lumen-splash-fadeout' : ''}`}
      onClick={startFadeOut}
      role="button"
      tabIndex={0}
      aria-label="Skip splash animation"
    >
      <video
        ref={videoRef}
        className="lumen-splash-video"
        src="/loading.mp4"
        autoPlay
        playsInline
        muted
        preload="auto"
        onEnded={startFadeOut}
        onError={() => {
          startFadeOut()
        }}
      />
    </div>
  )
}


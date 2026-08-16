import { useEffect, useRef, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onFinish?: () => void
  durationMs?: number
}

export function SplashScreen({ onFinish, durationMs = 2800 }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const handleComplete = () => {
    setFadingOut(true)
    setTimeout(() => {
      setHidden(true)
      if (onFinish) onFinish()
    }, 400)
  }

  useEffect(() => {
    // Try to programmatically play video in case autoplay is paused
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        setVideoReady(true)
      }).catch(() => {
        // Autoplay blocked by mobile browser - show animated fallback
        setVideoReady(false)
      })
    }

    const timer = setTimeout(() => {
      setFadingOut(true)
      const hideTimer = setTimeout(() => {
        setHidden(true)
        if (onFinish) {
          onFinish()
        }
      }, 500)
      return () => clearTimeout(hideTimer)
    }, durationMs)

    return () => clearTimeout(timer)
  }, [durationMs, onFinish])

  if (hidden) {
    return null
  }

  return (
    <div
      className={`lumen-splash-overlay${fadingOut ? ' lumen-splash-fadeout' : ''}`}
      onClick={handleComplete}
    >
      <div className="lumen-splash-fallback">
        <img src="/lumen-logo.png" alt="Lumen" className="lumen-splash-fallback-logo" />
        <div className="lumen-splash-glow" />
      </div>

      <video
        ref={videoRef}
        className={`lumen-splash-video${videoReady ? ' ready' : ''}`}
        src="/loading.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onPlaying={() => setVideoReady(true)}
        onLoadedData={() => setVideoReady(true)}
        onError={() => setVideoReady(false)}
      />
    </div>
  )
}

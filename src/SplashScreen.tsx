import { useEffect, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onFinish?: () => void
  durationMs?: number
}

export function SplashScreen({ onFinish, durationMs = 2800 }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadingOut(true)
      const hideTimer = setTimeout(() => {
        setHidden(true)
        if (onFinish) {
          onFinish()
        }
      }, 600)
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
      onClick={() => {
        setFadingOut(true)
        setTimeout(() => {
          setHidden(true)
          if (onFinish) onFinish()
        }, 300)
      }}
    >
      <video
        className="lumen-splash-video"
        src="/loading.mp4"
        autoPlay
        loop
        muted
        playsInline
        onError={() => setHidden(true)}
      />
    </div>
  )
}

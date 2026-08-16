import { useCallback, useEffect, useRef, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onFinish?: () => void
  durationMs?: number
}

export function SplashScreen({ onFinish, durationMs = 2800 }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false)
  const [hidden, setHidden] = useState(false)
  const finishCalledRef = useRef(false)

  const triggerFinish = useCallback(() => {
    if (finishCalledRef.current) return
    finishCalledRef.current = true
    setHidden(true)
    if (onFinish) {
      onFinish()
    }
  }, [onFinish])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadingOut(true)
      const hideTimer = setTimeout(() => {
        triggerFinish()
      }, 600)
      return () => clearTimeout(hideTimer)
    }, durationMs)

    return () => clearTimeout(timer)
  }, [durationMs, triggerFinish])

  if (hidden) {
    return null
  }

  return (
    <div
      className={`lumen-splash-overlay${fadingOut ? ' lumen-splash-fadeout' : ''}`}
      onClick={() => {
        setFadingOut(true)
        setTimeout(triggerFinish, 200)
      }}
    >
      <video
        className="lumen-splash-video"
        src="/loading.mp4"
        autoPlay
        loop
        muted
        playsInline
        onError={triggerFinish}
      />
    </div>
  )
}


import React, { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import './WelcomeScreen.css'
import islamicPattern from '../../assets/islamic_pattern_enhanced.png'
import { OntoLoader, AstralPreloader, WalbiIntroLoader, SpasojeLoader, MobilePulseLoader } from '../Loaders'

interface WelcomeScreenProps {
  onDone: () => void
  version?: string
}

type GreetingMode = 'ahlan' | 'marhaban'

export default function WelcomeScreen({ onDone, version = '26.8.9' }: WelcomeScreenProps): JSX.Element {
  const [fadeOut, setFadeOut] = useState(false)
  const [greetingMode, setGreetingMode] = useState<GreetingMode>(() => {
    return (localStorage.getItem('welcome_greeting_mode') as GreetingMode) || 'ahlan'
  })
  const [activeLoader] = useState(() => {
    return localStorage.getItem('ot_active_loader_theme') || 'onto'
  })
  const [loaderProgress, setLoaderProgress] = useState(0)
  const [typingKey, setTypingKey] = useState(0)
  const [windowWidth, setWindowWidth] = useState(() => {
    return window.innerWidth || document.documentElement.clientWidth || screen.width || 1920
  })
  const doneTriggeredRef = useRef(false)

  // Reset body zoom to 1.0 while WelcomeScreen is mounted so it covers 100% full screen
  useEffect(() => {
    const prevZoom = document.body.style.zoom
    document.body.style.zoom = '1'

    const handleResize = () => {
      setWindowWidth(window.innerWidth || document.documentElement.clientWidth || screen.width || 1920)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (prevZoom) {
        document.body.style.zoom = prevZoom
      }
    }
  }, [])

  // Calculate teardrop banner layout
  const teardropsLayout = useMemo(() => {
    const currentW = Math.max(windowWidth, 600)
    let dropWidth = 24
    let dropHeight = 39
    let targetSpacing = 52

    if (currentW >= 1800) {
      dropWidth = 30
      dropHeight = 50
      targetSpacing = 64
    } else if (currentW >= 1400) {
      dropWidth = 26
      dropHeight = 44
      targetSpacing = 58
    } else if (currentW >= 1000) {
      dropWidth = 24
      dropHeight = 39
      targetSpacing = 52
    } else {
      dropWidth = 20
      dropHeight = 32
      targetSpacing = 44
    }

    const count = Math.max(8, Math.floor(currentW / targetSpacing))
    return { count, dropWidth, dropHeight }
  }, [windowWidth])

  // Trigger smooth finish
  const handleComplete = () => {
    if (doneTriggeredRef.current) return
    doneTriggeredRef.current = true
    setFadeOut(true)
    setTimeout(() => {
      onDone()
    }, 500)
  }

  // Play soft luxury ambient chime when typing begins
  useEffect(() => {
    const chimeTimer = setTimeout(() => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) return
        const ctx = new AudioCtx()
        if (ctx.state === 'suspended') {
          ctx.resume()
        }
        const now = ctx.currentTime

        // Warm golden harmonic chord: F#4, A#4, C#5, F5
        const freqs = [369.99, 466.16, 554.37, 698.46]
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()

          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now + i * 0.07)

          gain.gain.setValueAtTime(0.0001, now + i * 0.07)
          gain.gain.exponentialRampToValueAtTime(0.038, now + i * 0.07 + 0.04)
          gain.gain.exponentialRampToValueAtTime(0.00001, now + i * 0.07 + 1.8)

          osc.connect(gain)
          gain.connect(ctx.destination)

          osc.start(now + i * 0.07)
          osc.stop(now + i * 0.07 + 1.9)
        })
      } catch (e) {
        // Audio policy or silent
      }
    }, 300)

    return () => clearTimeout(chimeTimer)
  }, [typingKey])

  // Auto-advance after loader animation completes (2.4s total duration)
  useEffect(() => {
    let startTime: number | null = null
    const duration = 2400

    let rafId: number
    const step = (time: number) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const progress = Math.min(100, (elapsed / duration) * 100)
      setLoaderProgress(Math.round(progress))

      if (progress < 100) {
        rafId = requestAnimationFrame(step)
      } else {
        setTimeout(handleComplete, 300)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [typingKey])

  // Keyboard shortcut (Enter / Space / Escape to continue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault()
        handleComplete()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Toggle between Ahlan Wa Sahlan and Marhaban
  const toggleGreetingMode = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextMode: GreetingMode = greetingMode === 'ahlan' ? 'marhaban' : 'ahlan'
    setGreetingMode(nextMode)
    localStorage.setItem('welcome_greeting_mode', nextMode)
    setTypingKey(k => k + 1)
  }

  const svgTeardropPath = 'M 50 0 C 45 40, 0 75, 0 110 C 0 145, 22.4 162, 50 162 C 77.6 162, 100 145, 100 110 C 100 75, 55 40, 50 0 Z'

  const content = (
    <div
      className={`welcome-screen-overlay ${fadeOut ? 'welcome-fade-out' : ''}`}
      onClick={handleComplete}
      title="Click anywhere to continue"
    >
      {/* Background Seamless Islamic Geometric Pattern Layer */}
      <div
        className="welcome-pattern-bg"
        style={{ backgroundImage: `url(${islamicPattern})` }}
      />

      {/* Ambient Center Radial Glow */}
      <div className="welcome-ambient-glow" />

      {/* Responsive Teardrops Header Banner */}
      <div className="welcome-teardrops-banner">
        {Array.from({ length: teardropsLayout.count }).map((_, i) => {
          const isMaroon = i % 2 === 0
          const fillClass = isMaroon ? 'welcome-teardrop-maroon' : 'welcome-teardrop-gold'

          return (
            <div
              key={i}
              className="welcome-teardrop-item"
              style={{
                animationDelay: `${Math.min(i * 25, 450)}ms`
              }}
            >
              <svg
                className={`welcome-teardrop-svg ${fillClass}`}
                width={teardropsLayout.dropWidth}
                height={teardropsLayout.dropHeight}
                viewBox="0 0 100 162"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d={svgTeardropPath} />
              </svg>
            </div>
          )
        })}
      </div>

      {/* Central Welcome Card - Centered in middle of screen */}
      <div className="welcome-content-card">
        {/* Arabic Calligraphy: Ahlan Wa Sahlan / Marhaban with RTL Typewriter */}
        <div className="welcome-greeting-wrapper" key={typingKey} onClick={toggleGreetingMode} title="Click to switch greeting style">
          <div
            className={`welcome-greeting-text ${
              greetingMode === 'marhaban' ? 'mode-marhaban' : ''
            }`}
          >
            {greetingMode === 'ahlan' ? 'أَهْلًا وَسَهْلًا' : 'مَرْحَبًا'}
          </div>
          <div className="welcome-greeting-accent" />
        </div>

        {/* Integrated Preloader positioned gracefully at the bottom */}
        <div className="welcome-loader-bottom-wrapper">
          {activeLoader === 'astral' && <AstralPreloader progress={loaderProgress} />}
          {activeLoader === 'walbi' && <WalbiIntroLoader progress={loaderProgress} />}
          {activeLoader === 'spasoje' && <SpasojeLoader progress={loaderProgress} />}
          {activeLoader === 'mobile' && <MobilePulseLoader progress={loaderProgress} />}
          {activeLoader === 'onto' && <OntoLoader progress={loaderProgress} hideTitle={true} subtext="UniDesk Audio & Video Engine" />}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

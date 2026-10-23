import React, { useEffect, useRef, useState } from 'react'
import './SplashScreen.css'
import zenLogo from '../../assets/zen_final_nobg.png'

interface SplashScreenProps {
  onDone: () => void
  ready?: boolean
  theme?: string
}

const TECHNICAL_LOGS = [
  'Initializing Uni Desk core runtime...',
  'Checking system architecture (x64 Windows)... [OK]',
  'Verifying FFmpeg binaries in PATH... [FOUND]',
  'Probing GPU hardware capabilities... H.264/HEVC [READY]',
  'Allocating thread pools for multi-channel automation...',
  'Loading index database structure from settings.json...',
  'Calibrating audio render buffers (512 samples)...',
  'Initializing Google OAuth handshake client...',
  'Checking Workspace cloud endpoint scripts... [CONNECTED]',
  'Mapping ExtendScript CEP pipeline ports...',
  'Preheating timeline assets cache...',
  'Ready to initialize creative session.'
]

const ParticleBackground = (): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)
    let mouseX = width / 2
    let mouseY = height / 2

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)

    // Vibrant Warm Gold, Amber & Terracotta particle color palette for light off-white background
    const colors = ['#D4AF37', '#B48A28', '#E0A96D', '#8A6520', '#C59B27', '#6E5326']

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      alpha: number
      color: string

      constructor() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = (Math.random() - 0.5) * 0.4
        this.vy = (Math.random() - 0.5) * 0.4
        this.radius = Math.random() * 1.8 + 0.8
        this.alpha = Math.random() * 0.55 + 0.25
        this.color = colors[Math.floor(Math.random() * colors.length)]
      }

      update() {
        this.x += this.vx
        this.y += this.vy

        // Subtle attraction to mouse cursor for interactive flair
        const dx = mouseX - this.x
        const dy = mouseY - this.y
        const dist = Math.hypot(dx, dy)
        if (dist < 180) {
          const force = (180 - dist) / 180
          this.x += (dx / dist) * force * 0.6
          this.y += (dy / dist) * force * 0.6
        }

        if (this.x < 0 || this.x > width) this.vx *= -1
        if (this.y < 0 || this.y > height) this.vy *= -1
      }

      draw() {
        if (!ctx) return
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        ctx.globalAlpha = this.alpha
        ctx.fillStyle = this.color
        ctx.shadowColor = '#D4AF37'
        ctx.shadowBlur = 4
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1.0
      }
    }

    const particles: Particle[] = []
    const particleCount = Math.min(75, Math.floor((width * height) / 25000))
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle())
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.update()
        p.draw()

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y)
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.18
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.globalAlpha = alpha
            ctx.strokeStyle = '#B48A28'
            ctx.lineWidth = 0.8
            ctx.stroke()
            ctx.globalAlpha = 1.0
          }
        }
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="splash-particles-canvas" />
}

export default function SplashScreen({ onDone, ready, theme }: SplashScreenProps): JSX.Element {
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut]   = useState(false)
  const [version, setVersion]   = useState('26.10.21')
  const [skipped, setSkipped]   = useState(false)
  const [displayedLogs, setDisplayedLogs] = useState<string[]>([])
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })

  const progressRef = useRef(0)
  const readyRef = useRef(false)
  const skippedRef = useRef(false)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    readyRef.current = !!ready
  }, [ready])

  useEffect(() => {
    if (window.api && window.api.update && typeof window.api.update.getCurrentVersion === 'function') {
      window.api.update.getCurrentVersion()
        .then((v: string) => setVersion(v))
        .catch(err => console.error('[SplashScreen] Failed to load version:', err))
    }
  }, [])

  // Sync log feed with progress milestones
  useEffect(() => {
    const list: string[] = []
    const prog = progress
    if (prog >= 0) list.push(TECHNICAL_LOGS[0])
    if (prog >= 10) list.push(TECHNICAL_LOGS[1])
    if (prog >= 20) list.push(TECHNICAL_LOGS[2])
    if (prog >= 30) list.push(TECHNICAL_LOGS[3])
    if (prog >= 40) list.push(TECHNICAL_LOGS[4])
    if (prog >= 50) list.push(TECHNICAL_LOGS[5])
    if (prog >= 60) list.push(TECHNICAL_LOGS[6])
    if (prog >= 70) list.push(TECHNICAL_LOGS[7])
    if (prog >= 80) list.push(TECHNICAL_LOGS[8])
    if (prog >= 90) list.push(TECHNICAL_LOGS[9])
    if (prog >= 95) list.push(TECHNICAL_LOGS[10])
    if (prog >= 100) list.push(TECHNICAL_LOGS[11])

    setDisplayedLogs(list.slice(-3))
  }, [progress])

  useEffect(() => {
    let lastTime = performance.now()

    function tick(now: number): void {
      if (!startRef.current) startRef.current = now
      const elapsed = now - startRef.current

      if (skippedRef.current) {
        progressRef.current = 100
      } else {
        const isAppReady = readyRef.current
        const minTimeMet = elapsed >= 450 

        if (isAppReady && minTimeMet) {
          const delta = (now - lastTime)
          progressRef.current = Math.min(100, progressRef.current + delta * 0.55)
        } else {
          const targetCreep = 90 * (1 - Math.exp(-elapsed / 350))
          progressRef.current = Math.min(90, Math.max(progressRef.current, targetCreep))
        }
      }

      lastTime = now
      const currentProgress = Math.round(progressRef.current)
      setProgress(currentProgress)

      if (progressRef.current < 100) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setTimeout(() => {
          setFadeOut(true)
          setTimeout(onDone, 500)
        }, 150)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [onDone])

  const handleSkip = (): void => {
    if (skippedRef.current || progressRef.current >= 100) return
    skippedRef.current = true
    setSkipped(true)
    setProgress(100)
  }

  const handleMouseMoveOverlay = (e: React.MouseEvent<HTMLDivElement>): void => {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const ry = ((e.clientX - cx) / cx) * 6
    const rx = -((e.clientY - cy) / cy) * 6
    setTilt({ rx, ry })
  }

  const handleMouseLeaveOverlay = (): void => {
    setTilt({ rx: 0, ry: 0 })
  }

  return (
    <div
      className={`splash-overlay ${fadeOut ? 'splash-fade-out' : ''} ${skipped ? 'splash-skipped' : ''}`}
      data-theme={theme}
      onClick={handleSkip}
      onMouseMove={handleMouseMoveOverlay}
      onMouseLeave={handleMouseLeaveOverlay}
      title="Click anywhere to skip"
    >
      {/* Constellation Particle Background */}
      <ParticleBackground />

      {/* Dynamic atmospheric background glow orbs - Warm Off-White & Gold Ambient */}
      <div className="splash-glow-orb orb-violet" />
      <div className="splash-glow-orb orb-blue" />
      <div className="splash-glow-orb orb-pink" />
      
      {/* Visual glass grid pattern overlay */}
      <div className="splash-grid-overlay" />

      <div 
        className="splash-card" 
        style={{
          transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="splash-accent-bar" />

        <div className="splash-body">
          <div className="splash-hero">
            <div className="splash-logo-wrapper" style={{ background: '#F7F4EE', padding: '12px', border: '1.5px solid rgba(229,192,123,0.4)', boxShadow: '0 8px 30px rgba(0,0,0,0.25), inset 0 0 15px rgba(255,255,255,0.6)' }}>
              <img src={zenLogo} alt="Zen Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            
            <div className="splash-title-block">
              <h1 className="splash-title">Uni Desk</h1>
               <p className="splash-subtitle">Professional Video Editor Workstation</p>
              
              <div className="splash-version-tag">
                <span className="version-pill">v{version}</span>
                <span className="status-pill">
                  <span className="status-dot animate-pulse-fast" />
                  SYSTEM ONLINE
                </span>
              </div>
            </div>
          </div>

          <div className="splash-divider" />

          <div className="splash-footer-row">
            <div className="splash-status-block">
              {/* Monospace terminal style boot logs */}
              <div className="splash-micro-terminal">
                {displayedLogs.map((log, idx) => (
                  <div key={idx} className="terminal-line">
                    <span className="terminal-prompt">&gt;</span>
                    <span className="terminal-text">{log}</span>
                  </div>
                ))}
              </div>
              <div className="splash-bar-track">
                <div
                  className="splash-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="splash-meta">
              <span className="splash-percent">{progress}%</span>
              <div className="splash-spinner-small" />
            </div>
          </div>
        </div>
        
        <div className="splash-legal">
          <span>© 2026 BS Framework. All rights reserved. Professional Grade Audio/Video Automation Platform.</span>
          <span className="splash-skip-tip">Click anywhere to skip</span>
        </div>
      </div>
    </div>
  )
}

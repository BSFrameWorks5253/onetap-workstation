import React, { useEffect, useRef } from 'react'
import zenLogoImg from '../../assets/zen_final_nobg.png'

interface AmbientParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
}

interface PixelMorphingLogoProps {
  size?: number
  onClick?: () => void
}

export default function PixelMorphingLogo({ size = 38, onClick }: PixelMorphingLogoProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const offCanvasARef = useRef<HTMLCanvasElement | null>(null)
  const offCanvasBRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<AmbientParticle[]>([])
  const hoverRef = useRef<boolean>(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr

    let isMounted = true

    // Create Offscreen Canvas A (Zen Logo on WHITE bg)
    const offA = document.createElement('canvas')
    offA.width = size * dpr
    offA.height = size * dpr
    const ctxA = offA.getContext('2d')

    if (ctxA) {
      ctxA.scale(dpr, dpr)
      ctxA.imageSmoothingEnabled = true
      ctxA.imageSmoothingQuality = 'high'

      // White background card
      ctxA.fillStyle = '#FFFFFF'
      ctxA.beginPath()
      ctxA.roundRect(0, 0, size, size, 8)
      ctxA.fill()
      ctxA.strokeStyle = 'rgba(0, 0, 0, 0.08)'
      ctxA.lineWidth = 1
      ctxA.stroke()
    }

    const img = new Image()
    img.src = zenLogoImg
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!isMounted || !ctxA) return
      ctxA.drawImage(img, 2, 2, size - 4, size - 4)
    }
    offCanvasARef.current = offA

    // Create Offscreen Canvas B (UNI Desk Emblem)
    const offB = document.createElement('canvas')
    offB.width = size * dpr
    offB.height = size * dpr
    const ctxB = offB.getContext('2d')

    if (ctxB) {
      ctxB.scale(dpr, dpr)
      ctxB.imageSmoothingEnabled = true
      ctxB.imageSmoothingQuality = 'high'

      const grad = ctxB.createLinearGradient(0, 0, size, size)
      grad.addColorStop(0, '#4F46E5')
      grad.addColorStop(1, '#7C3AED')

      ctxB.fillStyle = grad
      ctxB.beginPath()
      ctxB.roundRect(0, 0, size, size, 8)
      ctxB.fill()
      ctxB.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      ctxB.lineWidth = 1
      ctxB.stroke()

      // "U" Icon
      ctxB.fillStyle = '#FFFFFF'
      ctxB.beginPath()
      ctxB.arc(size / 2, size * 0.65, size * 0.25, 0, Math.PI, false)
      ctxB.lineTo(size / 2 - size * 0.25, size * 0.32)
      ctxB.lineTo(size / 2 - size * 0.1, size * 0.32)
      ctxB.lineTo(size / 2 - size * 0.1, size * 0.65)
      ctxB.arc(size / 2, size * 0.65, size * 0.1, Math.PI, 0, true)
      ctxB.lineTo(size / 2 + size * 0.1, size * 0.32)
      ctxB.lineTo(size / 2 + size * 0.25, size * 0.32)
      ctxB.closePath()
      ctxB.fill()

      // Cyan Accent Dot
      ctxB.fillStyle = '#38BDF8'
      ctxB.beginPath()
      ctxB.arc(size / 2, size * 0.24, size * 0.06, 0, Math.PI * 2)
      ctxB.fill()
    }
    offCanvasBRef.current = offB

    // Ambient Particles for Morphing Glow
    const particles: AmbientParticle[] = []
    const colors = ['#6366F1', '#38BDF8', '#F59E0B', '#10B981', '#A855F7']
    for (let i = 0; i < 36; i++) {
      particles.push({
        x: Math.random() * size,
        y: Math.random() * size,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 1.5,
        color: colors[i % colors.length],
        alpha: 0.2 + Math.random() * 0.5
      })
    }
    particlesRef.current = particles

    // 16,000ms Liquid Cycle:
    // 0ms -> 6000ms (0.0 -> 0.375): Hold State A (Zen Logo)
    // 6000ms -> 8000ms (0.375 -> 0.50): Liquid Transition A -> B
    // 8000ms -> 14000ms (0.50 -> 0.875): Hold State B (UNI Desk Emblem)
    // 14000ms -> 16000ms (0.875 -> 1.0): Liquid Transition B -> A
    let startTime = performance.now()
    const cycleDuration = 16000

    const render = (now: number) => {
      if (!isMounted) return
      const elapsed = (now - startTime) % cycleDuration
      const progress = elapsed / cycleDuration

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      // Calculate morph blend factor [0.0 = State A, 1.0 = State B]
      let morphFactor = 0
      let isTransitioning = false

      if (progress >= 0.375 && progress < 0.50) {
        isTransitioning = true
        const t = (progress - 0.375) / 0.125
        // Smooth easeInOutCubic
        morphFactor = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      } else if (progress >= 0.50 && progress < 0.875) {
        morphFactor = 1
      } else if (progress >= 0.875) {
        isTransitioning = true
        const t = (progress - 0.875) / 0.125
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        morphFactor = 1 - ease
      }

      // Draw Logo A (Zen) with smooth opacity cross-fade & micro-scale ease
      const alphaA = 1 - morphFactor
      if (alphaA > 0.001 && offCanvasARef.current) {
        ctx.save()
        ctx.globalAlpha = alphaA
        const scaleA = 1 + morphFactor * 0.12 // Gently scales up as it dissolves
        ctx.translate(size / 2, size / 2)
        ctx.scale(scaleA, scaleA)
        ctx.translate(-size / 2, -size / 2)
        ctx.drawImage(offCanvasARef.current, 0, 0, size * dpr, size * dpr, 0, 0, size, size)
        ctx.restore()
      }

      // Draw Logo B (UNI Desk) with smooth opacity cross-fade & micro-scale ease
      const alphaB = morphFactor
      if (alphaB > 0.001 && offCanvasBRef.current) {
        ctx.save()
        ctx.globalAlpha = alphaB
        const scaleB = 0.88 + morphFactor * 0.12 // Gently emerges into place
        ctx.translate(size / 2, size / 2)
        ctx.scale(scaleB, scaleB)
        ctx.translate(-size / 2, -size / 2)
        ctx.drawImage(offCanvasBRef.current, 0, 0, size * dpr, size * dpr, 0, 0, size, size)
        ctx.restore()
      }

      // Render Ambient Particle Shimmer during morphing transitions or hover
      if (isTransitioning || hoverRef.current) {
        const particles = particlesRef.current
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          p.x += p.vx * (isTransitioning ? 2.2 : 1)
          p.y += p.vy * (isTransitioning ? 2.2 : 1)

          if (p.x < 0) p.x = size
          if (p.x > size) p.x = 0
          if (p.y < 0) p.y = size
          if (p.y > size) p.y = 0

          ctx.fillStyle = p.color
          ctx.globalAlpha = p.alpha * (isTransitioning ? 0.85 : 0.4)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.restore()
      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      isMounted = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      onMouseEnter={() => { hoverRef.current = true }}
      onMouseLeave={() => { hoverRef.current = false }}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        cursor: 'pointer',
        display: 'block',
        borderRadius: '8px'
      }}
      title="Morphing Logo (Zeninfosys ↔ UNI-Desk)"
    />
  )
}

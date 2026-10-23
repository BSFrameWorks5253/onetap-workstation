import React, { useState, useEffect, useRef } from 'react'

interface AnimateNumberProps {
  value: number
  duration?: number
  formatter?: (n: number) => string
}

export default function AnimateNumber({ value, duration = 300, formatter }: AnimateNumberProps): JSX.Element {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)

  useEffect(() => {
    const start = prevValueRef.current
    const end = value
    prevValueRef.current = value

    if (start === end) {
      setDisplayValue(end)
      return
    }

    const startTime = performance.now()
    let animationFrameId: number

    const updateNumber = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function: easeOutQuad
      const ease = progress * (2 - progress)
      const current = Math.round(start + (end - start) * ease)
      
      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber)
      } else {
        setDisplayValue(end)
      }
    }

    animationFrameId = requestAnimationFrame(updateNumber)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [value, duration])

  return <span>{formatter ? formatter(displayValue) : displayValue}</span>
}

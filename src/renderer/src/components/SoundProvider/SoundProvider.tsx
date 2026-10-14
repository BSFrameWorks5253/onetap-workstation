import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react'

interface SoundContextType {
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  toggleMute: () => void
  volume: number
  setVolume: (vol: number) => void
  playTick: () => void
  playSuccess: () => void
  playError: () => void
  playBatchComplete: () => void
  playChecksumWarning: () => void
  playHotkeyTrigger: () => void
}

const SoundContext = createContext<SoundContextType | undefined>(undefined)

export function useSound(): SoundContextType {
  const context = useContext(SoundContext)
  if (!context) throw new Error('useSound must be used within a SoundProvider')
  return context
}

export function SoundProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const audioCtx = useRef<AudioContext | null>(null)
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('ot_sound_enabled') !== 'false'
  })
  const [volume, setVolumeState] = useState<number>(() => {
    const v = localStorage.getItem('ot_sound_volume')
    return v ? parseFloat(v) : 0.5
  })

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled)
    localStorage.setItem('ot_sound_enabled', enabled ? 'true' : 'false')
  }, [])

  const toggleMute = useCallback(() => {
    setSoundEnabledState(prev => {
      const next = !prev
      localStorage.setItem('ot_sound_enabled', next ? 'true' : 'false')
      return next
    })
  }, [])

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol))
    setVolumeState(clamped)
    localStorage.setItem('ot_sound_volume', String(clamped))
  }, [])

  const initCtx = () => {
    try {
      if (!audioCtx.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          audioCtx.current = new AudioContextClass()
        }
      }
      if (audioCtx.current && audioCtx.current.state === 'suspended') {
        audioCtx.current.resume()
      }
    } catch (e) {
      console.warn('Sound engine failed to init:', e)
    }
  }

  // 1. Subtle UI Button Tick / Click
  const playTick = useCallback(() => {
    if (!soundEnabled) return
    initCtx()
    if (!audioCtx.current) return
    const ctx = audioCtx.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const curVol = volume

    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.035)

    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.003 * curVol, ctx.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.035)
  }, [soundEnabled, volume])

  // 2. Standard Success Chime
  const playSuccess = useCallback(() => {
    if (!soundEnabled) return
    initCtx()
    if (!audioCtx.current) return
    const ctx = audioCtx.current
    const curVol = volume

    const playNote = (freq: number, time: number, dur: number, targetVol: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time)

      gain.gain.setValueAtTime(0, ctx.currentTime + time)
      gain.gain.linearRampToValueAtTime(targetVol * curVol, ctx.currentTime + time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + time)
      osc.stop(ctx.currentTime + time + dur)
    }

    playNote(659.25, 0.0, 0.2, 0.08)    // E5
    playNote(830.61, 0.08, 0.2, 0.08)   // G#5
    playNote(987.77, 0.16, 0.4, 0.08)   // B5
  }, [soundEnabled, volume])

  // 3. Batch Job Completion Chime (Rich 4-Tone Shimmer Chord)
  const playBatchComplete = useCallback(() => {
    if (!soundEnabled) return
    initCtx()
    if (!audioCtx.current) return
    const ctx = audioCtx.current
    const curVol = volume

    const playChimeNote = (freq: number, time: number, dur: number, targetVol: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time)

      gain.gain.setValueAtTime(0, ctx.currentTime + time)
      gain.gain.linearRampToValueAtTime(targetVol * curVol, ctx.currentTime + time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + time)
      osc.stop(ctx.currentTime + time + dur)
    }

    // Ascending C Major 9 shimmer chord with gentle chime ring
    playChimeNote(523.25, 0.00, 0.45, 0.09) // C5
    playChimeNote(659.25, 0.09, 0.45, 0.09) // E5
    playChimeNote(783.99, 0.18, 0.55, 0.09) // G5
    playChimeNote(1046.50, 0.27, 0.70, 0.10) // C6
  }, [soundEnabled, volume])

  // 4. Checksum Warning / Integrity Alert
  const playChecksumWarning = useCallback(() => {
    if (!soundEnabled) return
    initCtx()
    if (!audioCtx.current) return
    const ctx = audioCtx.current
    const curVol = volume

    const playAlertPulse = (startTime: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, ctx.currentTime + startTime)
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + startTime + 0.14)

      gain.gain.setValueAtTime(0, ctx.currentTime + startTime)
      gain.gain.linearRampToValueAtTime(0.06 * curVol, ctx.currentTime + startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + 0.14)

      // Low-pass filter for smooth warning
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(450, ctx.currentTime + startTime)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + startTime)
      osc.stop(ctx.currentTime + startTime + 0.14)
    }

    // Double warning pulse
    playAlertPulse(0.0)
    playAlertPulse(0.18)
  }, [soundEnabled, volume])

  // 5. Tactile Hotkey / Palette Execution Micro-Cue
  const playHotkeyTrigger = useCallback(() => {
    if (!soundEnabled) return
    initCtx()
    if (!audioCtx.current) return
    const ctx = audioCtx.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const curVol = volume

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.02)

    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.008 * curVol, ctx.currentTime + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.02)
  }, [soundEnabled, volume])

  // 6. Generic Error Sound
  const playError = useCallback(() => {
    if (!soundEnabled) return
    initCtx()
    if (!audioCtx.current) return
    const ctx = audioCtx.current
    const curVol = volume

    const playNote = (freq: number, startVol: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)

      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(startVol * curVol, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    }

    playNote(220.00, 0.06) // A3
    playNote(233.08, 0.03) // Bb3
  }, [soundEnabled, volume])

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        setSoundEnabled,
        toggleMute,
        volume,
        setVolume,
        playTick,
        playSuccess,
        playError,
        playBatchComplete,
        playChecksumWarning,
        playHotkeyTrigger
      }}
    >
      {children}
    </SoundContext.Provider>
  )
}

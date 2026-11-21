import React, { createContext, useEffect, useState, useCallback, useMemo } from 'react'
import { CursorContextValue, CursorType } from './cursorTypes'
import { CursorShowcaseModal } from './CursorShowcaseModal'
import './cursor.css'

export const CursorContext = createContext<CursorContextValue | null>(null)

const STORAGE_KEY = 'onetap_custom_cursor_enabled'

export interface CursorProviderProps {
  children: React.ReactNode
  defaultEnabled?: boolean
}

export const CursorProvider: React.FC<CursorProviderProps> = ({
  children,
  defaultEnabled = true
}) => {
  const [currentCursor, setCurrentCursorState] = useState<CursorType>('default')
  const [isShowcaseOpen, setIsShowcaseOpen] = useState<boolean>(false)

  // Load initial enabled preference from localStorage if available
  const [isCustomCursorEnabled, setIsCustomCursorEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        return saved === 'true'
      }
    } catch {
      // Fallback if localStorage is inaccessible
    }
    return defaultEnabled
  })

  const setCustomCursorEnabled = useCallback((enabled: boolean) => {
    setIsCustomCursorEnabled(enabled)
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // Ignore storage errors
    }
  }, [])

  const toggleCustomCursor = useCallback(() => {
    setCustomCursorEnabled(!isCustomCursorEnabled)
  }, [isCustomCursorEnabled, setCustomCursorEnabled])

  const setCursor = useCallback((type: CursorType) => {
    setCurrentCursorState(type)
  }, [])

  const resetCursor = useCallback(() => {
    setCurrentCursorState('default')
  }, [])

  const openShowcase = useCallback(() => {
    setIsShowcaseOpen(true)
  }, [])

  const closeShowcase = useCallback(() => {
    setIsShowcaseOpen(false)
  }, [])

  // Sync html and body classes with cursor state
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    if (isCustomCursorEnabled) {
      root.classList.add('custom-cursor-enabled')
      body.classList.add('custom-cursor-enabled')
    } else {
      root.classList.remove('custom-cursor-enabled')
      body.classList.remove('custom-cursor-enabled')
    }

    return () => {
      root.classList.remove('custom-cursor-enabled')
      body.classList.remove('custom-cursor-enabled')
    }
  }, [isCustomCursorEnabled])

  // Handle active temporary override
  useEffect(() => {
    const body = document.body
    if (!isCustomCursorEnabled || currentCursor === 'default') return

    const overrideClass = `cursor-override-${currentCursor}`
    body.classList.add(overrideClass)
    return () => {
      body.classList.remove(overrideClass)
    }
  }, [currentCursor, isCustomCursorEnabled])

  // Global shortcut to open developer showcase: Ctrl+Shift+C / Cmd+Shift+C
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault()
        setIsShowcaseOpen((prev) => !prev)
      }
    }

    const handleCustomEvent = (): void => {
      setIsShowcaseOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('onetap:open-cursor-showcase', handleCustomEvent)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('onetap:open-cursor-showcase', handleCustomEvent)
    }
  }, [])

  const contextValue = useMemo<CursorContextValue>(
    () => ({
      currentCursor,
      setCursor,
      resetCursor,
      isCustomCursorEnabled,
      setCustomCursorEnabled,
      toggleCustomCursor,
      isShowcaseOpen,
      openShowcase,
      closeShowcase
    }),
    [
      currentCursor,
      setCursor,
      resetCursor,
      isCustomCursorEnabled,
      setCustomCursorEnabled,
      toggleCustomCursor,
      isShowcaseOpen,
      openShowcase,
      closeShowcase
    ]
  )

  return (
    <CursorContext.Provider value={contextValue}>
      {children}
      <CursorShowcaseModal
        isOpen={isShowcaseOpen}
        onClose={closeShowcase}
        isCustomCursorEnabled={isCustomCursorEnabled}
        onToggleEnabled={toggleCustomCursor}
      />
    </CursorContext.Provider>
  )
}

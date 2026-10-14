import { useContext } from 'react'
import { CursorContext } from './CursorProvider'
import { CursorContextValue, CursorType } from './cursorTypes'

/**
 * Hook to access and control the application's custom cursor system.
 */
export function useCursor(): CursorContextValue {
  const context = useContext(CursorContext)
  if (!context) {
    // Fallback safe dummy context if rendered outside of CursorProvider
    return {
      currentCursor: 'default',
      setCursor: () => {},
      resetCursor: () => {},
      isCustomCursorEnabled: false,
      setCustomCursorEnabled: () => {},
      toggleCustomCursor: () => {},
      isShowcaseOpen: false,
      openShowcase: () => {},
      closeShowcase: () => {}
    }
  }
  return context
}

/**
 * Convenient helper hook to set a cursor for the lifetime of a component or state.
 */
export function useScopedCursor(type: CursorType, active: boolean = true): void {
  const { setCursor, resetCursor } = useCursor()

  // Sets cursor on mount or when active changes, cleans up on unmount
  if (active) {
    setCursor(type)
  }
}

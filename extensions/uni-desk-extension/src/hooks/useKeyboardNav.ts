import { useEffect } from 'react';

interface KeyHandlers {
  onArrowDown: () => void;
  onArrowUp: () => void;
  onEnter: () => void;
  onCtrlEnter: () => void;
  onShiftEnter: () => void;
  onAltEnter: () => void;
  onTab: () => void;
  onEscape: () => void;
}

export function useKeyboardNav(handlers: KeyHandlers, isEnabled: boolean = true) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside text input/textarea except Arrow/Enter/Escape
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handlers.onArrowDown();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlers.onArrowUp();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handlers.onCtrlEnter();
        } else if (e.shiftKey) {
          handlers.onShiftEnter();
        } else if (e.altKey) {
          handlers.onAltEnter();
        } else {
          handlers.onEnter();
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handlers.onTab();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handlers.onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, isEnabled]);
}

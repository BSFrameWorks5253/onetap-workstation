import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import type { ThemeName, AnimPreset, PageKey } from '../types'
import { NAV_ORDER, PAGE_META } from '../types'

interface ThemeContextValue {
  theme: ThemeName
  animPreset: AnimPreset
  setTheme: (t: ThemeName) => void
  setAnimPreset: (p: AnimPreset) => void
  // Per-page accent color overrides (hex strings or empty)
  accentOverrides: Record<string, string>
  setAccentOverride: (page: string, color: string) => void
  customFont: string
  customTextColor: string
  customBgColor: string
  setCustomFont: (font: string) => void
  setCustomTextColor: (color: string) => void
  setCustomBgColor: (color: string) => void
  textOverrides: Record<string, string>
  setTextOverride: (key: string, value: string) => void
  pageTransition: string
  setPageTransition: (trans: string) => void
  orderedNav: PageKey[]
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'glass',
  animPreset: 'balanced',
  setTheme: () => {},
  setAnimPreset: () => {},
  accentOverrides: {},
  setAccentOverride: () => {},
  customFont: '',
  customTextColor: '',
  customBgColor: '',
  setCustomFont: () => {},
  setCustomTextColor: () => {},
  setCustomBgColor: () => {},
  textOverrides: {},
  setTextOverride: () => {},
  pageTransition: 'fade',
  setPageTransition: () => {},
  orderedNav: [...NAV_ORDER]
})

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const local = localStorage.getItem('ot_theme') as ThemeName
    if (local && ['glass', 'beige', 'light', 'forest'].includes(local)) {
      document.documentElement.setAttribute('data-theme', local)
      return local
    }
    document.documentElement.setAttribute('data-theme', 'glass')
    return 'glass'
  })
  const [animPreset, setAnimPresetState] = useState<AnimPreset>('balanced')
  const [accentOverrides, setAccentOverrides] = useState<Record<string, string>>({})
  const [customFont, setCustomFontState] = useState('')
  const [customTextColor, setCustomTextColorState] = useState('')
  const [customBgColor, setCustomBgColorState] = useState('')
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({})
  const [pageTransition, setPageTransitionState] = useState('fade')
  const [_loaded, setLoaded] = useState(false)

  // Load persisted settings on mount
  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const api = (window as any).api
        const all = (await api.settings.getAll()) as Record<string, unknown>

        const localTheme = localStorage.getItem('ot_theme') as ThemeName
        const rawTheme = (all.app_theme as ThemeName) || localTheme
        const savedTheme: ThemeName = (rawTheme && ['glass', 'beige', 'light', 'forest'].includes(rawTheme)) ? rawTheme : 'glass'
        const savedAnim  = (all.anim_preset as AnimPreset) ?? 'balanced'
        const overrides: Record<string, string> = {}
        for (const page of ['adder', 'converter', 'drivesync', 'folder', 'settings']) {
          const v = all[`accent_${page}`] as string | undefined
          if (v) overrides[page] = v
        }

        setThemeState(savedTheme)
        setAnimPresetState(savedAnim)
        setAccentOverrides(overrides)
        
        const cFont = (all.custom_font as string) || ''
        const cText = (all.custom_text_color as string) || ''
        const cBg = (all.custom_bg_color as string) || ''
        setCustomFontState(cFont)
        setCustomTextColorState(cText)
        setCustomBgColorState(cBg)
        
        const trans = (all.page_transition as string) || 'fade'
        setPageTransitionState(trans)

        const to = (all.text_overrides as Record<string, string>) || {}
        setTextOverrides(to)
        applyTextOverrides(to)

        applyTheme(savedTheme)
        if (api?.settings?.setAndSave && all.app_theme !== savedTheme) {
          api.settings.setAndSave('app_theme', savedTheme).catch(() => {})
        }
        applyAccentOverrides(overrides)
        applyCustomStyles(cFont, cText, cBg)
      } catch {
        // Dev mode fallback: read from localStorage
        const local = localStorage.getItem('ot_theme') as ThemeName
        const t: ThemeName = (local && ['glass', 'beige', 'light', 'forest'].includes(local)) ? local : 'glass'
        setThemeState(t)
        applyTheme(t)
      } finally {
        setLoaded(true)
      }
    }
    load()

    // Safety fallback: if load() hangs, force show after 1.5s
    const timer = setTimeout(() => {
      setLoaded(prev => {
        if (!prev) console.warn('Theme load timed out, using defaults')
        return true
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // Apply theme to <html data-theme="...">
  function applyTheme(t: ThemeName): void {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('ot_theme', t)
  }

  function applyTextOverrides(overrides: Record<string, string>) {
    // We mutate the global PAGE_META object so we don't have to refactor 30 files
    for (const [k, v] of Object.entries(overrides)) {
      if (k.startsWith('page_label_')) {
        const pk = k.replace('page_label_', '')
        if (PAGE_META[pk]) PAGE_META[pk].label = v
      }
      if (k.startsWith('page_sub_')) {
        const pk = k.replace('page_sub_', '')
        if (PAGE_META[pk]) PAGE_META[pk].subtitle = v
      }
    }
  }

  // Apply CSS variable overrides for custom accent colors
  function applyAccentOverrides(overrides: Record<string, string>): void {
    const root = document.documentElement.style
    for (const [page, color] of Object.entries(overrides)) {
      if (color) {
        root.setProperty(`--accent-${page}`, color)
        // Compute hover (15% darker) and soft (88% lighter)
        root.setProperty(`--accent-${page}-hv`, darken(color, 0.15))
        root.setProperty(`--accent-${page}-soft`, lighten(color, 0.88))
      }
    }
  }

  function applyCustomStyles(f: string, t: string, b: string) {
    const root = document.documentElement.style
    if (f) {
      root.setProperty('--font-sans', `${f}, sans-serif`)
      root.setProperty('--font-display', `${f}, sans-serif`)
    } else {
      root.removeProperty('--font-sans')
      root.removeProperty('--font-display')
    }
    if (t) root.setProperty('--text-primary', t); else root.removeProperty('--text-primary');
    if (b) {
      root.setProperty('--bg', b)
      root.setProperty('--sidebar-bg', darken(b, 0.05))
    } else {
      root.removeProperty('--bg')
      root.removeProperty('--sidebar-bg')
    }
  }

  const setTheme = useCallback(async (t: ThemeName) => {
    setThemeState(t)
    applyTheme(t)
    try {
      const api = (window as any).api
      await api.settings.setAndSave('app_theme', t)
    } catch { /* dev mode */ }
  }, [])

  const setAnimPreset = useCallback(async (p: AnimPreset) => {
    setAnimPresetState(p)
    try {
      const api = (window as any).api
      await api.settings.setAndSave('anim_preset', p)
    } catch { /* dev mode */ }
    // Apply CSS duration vars
    const durMap: Record<AnimPreset, string> = {
      calm:      '380ms',
      balanced:  '240ms',
      cinematic: '500ms'
    }
    document.documentElement.style.setProperty('--dur-normal', durMap[p])
  }, [])

  const setAccentOverride = useCallback(async (page: string, color: string) => {
    const next = { ...accentOverrides, [page]: color }
    setAccentOverrides(next)
    applyAccentOverrides({ [page]: color })
    try {
      const api = (window as any).api
      await api.settings.setAndSave(`accent_${page}`, color)
    } catch { /* dev mode */ }
  }, [accentOverrides])

  const setCustomFont = useCallback(async (font: string) => {
    setCustomFontState(font)
    applyCustomStyles(font, customTextColor, customBgColor)
    try {
      const api = (window as any).api
      await api.settings.setAndSave('custom_font', font)
    } catch { /* dev mode */ }
  }, [customTextColor, customBgColor])

  const setCustomTextColor = useCallback(async (color: string) => {
    setCustomTextColorState(color)
    applyCustomStyles(customFont, color, customBgColor)
    try {
      const api = (window as any).api
      await api.settings.setAndSave('custom_text_color', color)
    } catch { /* dev mode */ }
  }, [customFont, customBgColor])

  const setCustomBgColor = useCallback(async (color: string) => {
    setCustomBgColorState(color)
    applyCustomStyles(customFont, customTextColor, color)
    try {
      const api = (window as any).api
      await api.settings.setAndSave('custom_bg_color', color)
    } catch { /* dev mode */ }
  }, [customFont, customTextColor])

  const setTextOverride = useCallback(async (key: string, value: string) => {
    const next = { ...textOverrides, [key]: value }
    setTextOverrides(next)
    applyTextOverrides(next)
    try {
      const api = (window as any).api
      await api.settings.setAndSave('text_overrides', next)
    } catch { /* dev mode */ }
  }, [textOverrides])

  const setPageTransition = useCallback(async (trans: string) => {
    setPageTransitionState(trans)
    try {
      const api = (window as any).api
      await api.settings.setAndSave('page_transition', trans)
    } catch { /* dev mode */ }
  }, [])

  const orderedNav = useMemo(() => {
    try {
      const saved = textOverrides['nav_order']
      if (saved) {
        const parsed = JSON.parse(saved) as PageKey[]
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(k => NAV_ORDER.includes(k))
          const missing = NAV_ORDER.filter(k => !valid.includes(k))
          return [...valid, ...missing]
        }
      }
    } catch {}
    return [...NAV_ORDER]
  }, [textOverrides['nav_order']])

  // if (!loaded) return <></> // Prevent flash before settings load

  return (
    <ThemeContext.Provider value={{ 
      theme, animPreset, setTheme, setAnimPreset, accentOverrides, setAccentOverride,
      customFont, customTextColor, customBgColor, setCustomFont, setCustomTextColor, setCustomBgColor,
      textOverrides, setTextOverride, pageTransition, setPageTransition,
      orderedNav
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

// ── Color helpers ──────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

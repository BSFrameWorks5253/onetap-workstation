/**
 * Safe Sharp Native Module Loader
 * Prevents main-process crashes when sharp's native binary or @img/sharp-win32-x64 is missing.
 */
let cachedSharp: any = null
let loadAttempted = false

export async function getSharp(): Promise<any | null> {
  if (cachedSharp) return cachedSharp
  if (loadAttempted) return null
  loadAttempted = true

  try {
    const mod = await import('sharp')
    cachedSharp = mod.default || mod
    return cachedSharp
  } catch (err: any) {
    console.warn(
      '[SharpHelper] Sharp native binary could not be loaded. Operating in fallback mode without crashing:',
      err?.message || err
    )
    return null
  }
}


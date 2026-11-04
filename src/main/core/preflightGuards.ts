import { dialog } from 'electron'

// Suppress default Electron error dialogs for transient Windows file locks (EBUSY / EPERM / OneDrive locks / Sharp)
try {
  const originalShowErrorBox = dialog.showErrorBox
  dialog.showErrorBox = (title, content) => {
    const text = String(content || '')
    if (
      text.includes('EBUSY') ||
      text.includes('AMEEncodingLog.txt') ||
      text.includes('resource busy or locked') ||
      text.includes('EPERM') ||
      text.includes('sharp') ||
      text.includes('@img') ||
      text.includes('ENOENT')
    ) {
      console.warn('[Suppressed Preflight / Native Module ErrorBox]:', title, text)
      return
    }
    return originalShowErrorBox.call(dialog, title, content)
  }
} catch {}

process.on('uncaughtException', (err: any) => {
  const msg = String(err?.message || err || '')
  if (msg.includes('sharp') || msg.includes('@img') || msg.includes('EBUSY')) {
    console.warn('[Suppressed Native UncaughtException]:', msg)
    return
  }
  console.error('[Main Process UncaughtException Suppressed]:', msg)
})

process.on('unhandledRejection', (reason: any) => {
  const msg = String(reason?.message || reason || '')
  if (msg.includes('sharp') || msg.includes('@img') || msg.includes('EBUSY')) {
    console.warn('[Suppressed Native UnhandledRejection]:', msg)
    return
  }
  console.error('[Main Process UnhandledRejection Suppressed]:', msg)
})


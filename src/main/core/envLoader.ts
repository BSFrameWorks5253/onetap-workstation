import fs from 'fs'
import path from 'path'

/**
 * Custom zero-dependency .env file parser/loader for Electron main process.
 */
export function loadEnv(): void {
  // Support both development (workspace root) and production directory structures
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '../../.env'),
    path.join(path.dirname(process.execPath), '.env')
  ]

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8')
        content.split(/\r?\n/).forEach(line => {
          // Remove comments and whitespace
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) return

          const eqIdx = trimmed.indexOf('=')
          if (eqIdx === -1) return

          const key = trimmed.substring(0, eqIdx).trim()
          let value = trimmed.substring(eqIdx + 1).trim()

          // Strip surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1)
          }

          process.env[key] = value
        })
        console.log(`[EnvLoader] Successfully loaded environment variables from: ${envPath}`)
        break
      } catch (err) {
        console.error(`[EnvLoader] Failed to read .env file at ${envPath}:`, err)
      }
    }
  }
}

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { Notification, BrowserWindow } from 'electron'

export interface DriveCandidate {
  letter: string
  root: string
  label: string
  sizeBytes?: number
  freeBytes?: number
  hasSafarData: boolean
  isLikelyBackup: boolean
}

export interface ReconcileItem {
  safarName: string
  dateFolder?: string
  workingPath: string
  expectedBackupPath: string
  type: 'missing_safar' | 'missing_date_folder' | 'out_of_sync'
  fileCount?: number
  missingFileCount?: number
}

export interface BackupReconcileResult {
  success: boolean
  workingDrive: string
  backupDrive: string
  workingSafarRoot: string
  backupSafarRoot: string
  missingSafars: ReconcileItem[]
  missingDateFolders: ReconcileItem[]
  outOfSyncFolders: ReconcileItem[]
  totalMissingItems: number
  allDrives: DriveCandidate[]
  timestamp: number
  error?: string
}

/**
 * Enumerate system drives and classify potential Working (D:) and Backup (4TB / External) drives
 */
export function getDriveCandidates(): DriveCandidate[] {
  const candidates: DriveCandidate[] = []

  if (process.platform === 'win32') {
    try {
      const psCmd = 'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace, DriveType | ConvertTo-Json"'
      const output = execSync(psCmd, { encoding: 'utf-8', timeout: 5000 }).trim()
      if (output) {
        const parsed = JSON.parse(output)
        const list = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of list) {
          const letter = (item.DeviceID || '').toUpperCase()
          if (!letter) continue
          const root = `${letter}\\`
          const size = item.Size ? parseInt(item.Size, 10) : 0
          const free = item.FreeSpace ? parseInt(item.FreeSpace, 10) : 0
          const label = item.VolumeName || `Local Disk (${letter})`
          const hasSafar = fs.existsSync(path.join(root, 'SAFAR DATA'))
          
          // 4TB drive size is approx 3.6 TB - 4.0 TB (3.9e12 to 4.1e12 bytes)
          // or external drive (DriveType 2 = Removable, 3 = Fixed)
          const is4TB = size > 3.4e12 && size < 4.4e12
          const isLikelyBackup = is4TB || /backup|external|4tb|archive|safar/i.test(label)

          candidates.push({
            letter,
            root,
            label,
            sizeBytes: size,
            freeBytes: free,
            hasSafarData: hasSafar,
            isLikelyBackup
          })
        }
      }
    } catch {
      // Fallback simple drive check
      for (const char of ['C', 'D', 'E', 'F', 'G', 'H', 'I']) {
        const root = `${char}:\\`
        if (fs.existsSync(root)) {
          const hasSafar = fs.existsSync(path.join(root, 'SAFAR DATA'))
          candidates.push({
            letter: `${char}:`,
            root,
            label: `Disk (${char}:)`,
            hasSafarData: hasSafar,
            isLikelyBackup: char !== 'C' && char !== 'D'
          })
        }
      }
    }
  } else {
    candidates.push({
      letter: '/',
      root: '/',
      label: 'Root (/)',
      hasSafarData: fs.existsSync('/SAFAR DATA'),
      isLikelyBackup: false
    })

    const checkRoots = [
      '/mnt',
      '/media',
      process.env.USER ? `/media/${process.env.USER}` : '',
      '/run/media',
      process.env.USER ? `/run/media/${process.env.USER}` : ''
    ].filter(Boolean)

    for (const cr of checkRoots) {
      if (fs.existsSync(cr)) {
        try {
          const entries = fs.readdirSync(cr, { withFileTypes: true })
          for (const ent of entries) {
            if (ent.isDirectory()) {
              const root = path.join(cr, ent.name)
              const hasSafar = fs.existsSync(path.join(root, 'SAFAR DATA'))
              candidates.push({
                letter: root,
                root: root,
                label: `Volume (${ent.name})`,
                hasSafarData: hasSafar,
                isLikelyBackup: /backup|external|4tb|archive|safar/i.test(ent.name)
              })
            }
          }
        } catch {}
      }
    }
  }

  return candidates
}

/**
 * Reconciles Working Drive and 4TB Backup Drive enforcing root `<BackupDrive>:\SAFAR DATA\<SafarName>\<DateFolder>\...`
 */
export async function reconcileWorkingAndBackupDrives(
  customWorkingDrive?: string,
  customBackupDrive?: string,
  notifyOnMismatch: boolean = true,
  getWin?: () => BrowserWindow | null
): Promise<BackupReconcileResult> {
  const allDrives = getDriveCandidates()

  // Determine working drive (default D: or specified, or drive with SAFAR DATA)
  let workingLetter = customWorkingDrive ? customWorkingDrive.toUpperCase().replace(/[/\\]+$/, '') : ''
  if (!workingLetter) {
    const hasD = allDrives.find(d => d.letter === 'D:' && d.hasSafarData) || allDrives.find(d => d.letter === 'D:')
    workingLetter = hasD ? hasD.letter : (allDrives[0]?.letter || 'D:')
  }

  // Determine backup drive (default external 4TB drive or drive with SAFAR DATA other than working)
  let backupLetter = customBackupDrive ? customBackupDrive.toUpperCase().replace(/[/\\]+$/, '') : ''
  if (!backupLetter) {
    const backupCandidate = allDrives.find(d => d.letter !== workingLetter && (d.isLikelyBackup || d.hasSafarData))
    backupLetter = backupCandidate ? backupCandidate.letter : (allDrives.find(d => d.letter !== workingLetter)?.letter || 'E:')
  }

  const workingBase = workingLetter.includes(':') ? `${workingLetter}\\` : workingLetter
  const backupBase = backupLetter.includes(':') ? `${backupLetter}\\` : backupLetter
  const workingSafarRoot = path.join(workingBase, 'SAFAR DATA')
  const backupSafarRoot = path.join(backupBase, 'SAFAR DATA')

  const missingSafars: ReconcileItem[] = []
  const missingDateFolders: ReconcileItem[] = []
  const outOfSyncFolders: ReconcileItem[] = []

  // Collect candidate working Safar folders from both <workingLetter>\SAFAR DATA and <workingLetter>\ root
  const candidateWorkingSafars: Array<{ name: string; fullPath: string }> = []
  const seenSafarNames = new Set<string>()

  if (fs.existsSync(workingSafarRoot)) {
    try {
      const items = fs.readdirSync(workingSafarRoot, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      for (const it of items) {
        if (!seenSafarNames.has(it.name.toLowerCase())) {
          seenSafarNames.add(it.name.toLowerCase())
          candidateWorkingSafars.push({ name: it.name, fullPath: path.join(workingSafarRoot, it.name) })
        }
      }
    } catch {}
  }

  if (fs.existsSync(workingBase)) {
    try {
      const rootItems = fs.readdirSync(workingBase, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('$') && d.name.toUpperCase() !== 'SAFAR DATA')
      for (const it of rootItems) {
        // Match Safar naming patterns e.g. "1448-08 Mumbai", "1447-02 ...", or "YYYY-MM City"
        const isSafarPattern = /^\d{4}[\s-_.]\d{1,3}/i.test(it.name) || /^\d{1,3}[\s-_.]+[A-Za-z]/i.test(it.name)
        if (isSafarPattern && !seenSafarNames.has(it.name.toLowerCase())) {
          seenSafarNames.add(it.name.toLowerCase())
          candidateWorkingSafars.push({ name: it.name, fullPath: path.join(workingBase, it.name) })
        }
      }
    } catch {}
  }

  if (candidateWorkingSafars.length === 0) {
    return {
      success: true,
      workingDrive: workingLetter,
      backupDrive: backupLetter,
      workingSafarRoot,
      backupSafarRoot,
      missingSafars: [],
      missingDateFolders: [],
      outOfSyncFolders: [],
      totalMissingItems: 0,
      allDrives,
      timestamp: Date.now()
    }
  }

  try {
    for (const sf of candidateWorkingSafars) {
      const safarName = sf.name
      const workingSafarPath = sf.fullPath

      // Check backup destinations: either <backupSafarRoot>\<safarName> OR <backupBase>\<safarName>
      const candidateBackup1 = path.join(backupSafarRoot, safarName)
      const candidateBackup2 = path.join(backupBase, safarName)
      let expectedBackupSafarPath = candidateBackup1

      if (fs.existsSync(candidateBackup1)) {
        expectedBackupSafarPath = candidateBackup1
      } else if (fs.existsSync(candidateBackup2)) {
        expectedBackupSafarPath = candidateBackup2
      } else {
        // Neither exists on backup drive
        missingSafars.push({
          safarName,
          workingPath: workingSafarPath,
          expectedBackupPath: candidateBackup1,
          type: 'missing_safar'
        })
        continue
      }

      // If Safar exists on backup, check its date subfolders
      const dateSubfolders = fs.readdirSync(workingSafarPath, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))

      for (const df of dateSubfolders) {
        const dateFolder = df.name
        const workingDatePath = path.join(workingSafarPath, dateFolder)
        const expectedBackupDatePath = path.join(expectedBackupSafarPath, dateFolder)

        if (!fs.existsSync(expectedBackupDatePath)) {
          let fileCount = 0
          try {
            fileCount = fs.readdirSync(workingDatePath).length
          } catch {}

          missingDateFolders.push({
            safarName,
            dateFolder,
            workingPath: workingDatePath,
            expectedBackupPath: expectedBackupDatePath,
            type: 'missing_date_folder',
            fileCount
          })
        } else {
          // Both exist: check for missing files
          try {
            const workingFiles = fs.readdirSync(workingDatePath)
            const backupFiles = new Set(fs.readdirSync(expectedBackupDatePath))
            let missingInBackup = 0
            for (const f of workingFiles) {
              if (!backupFiles.has(f)) {
                missingInBackup++
              }
            }
            if (missingInBackup > 0) {
              outOfSyncFolders.push({
                safarName,
                dateFolder,
                workingPath: workingDatePath,
                expectedBackupPath: expectedBackupDatePath,
                type: 'out_of_sync',
                missingFileCount: missingInBackup
              })
            }
          } catch {}
        }
      }
    }
  } catch (err: any) {
    return {
      success: false,
      workingDrive: workingLetter,
      backupDrive: backupLetter,
      workingSafarRoot,
      backupSafarRoot,
      missingSafars,
      missingDateFolders,
      outOfSyncFolders,
      totalMissingItems: missingSafars.length + missingDateFolders.length + outOfSyncFolders.length,
      allDrives,
      timestamp: Date.now(),
      error: err?.message || String(err)
    }
  }

  const totalMissingItems = missingSafars.length + missingDateFolders.length + outOfSyncFolders.length

  // Dispatch Windows Desktop Notification if mismatches found
  if (notifyOnMismatch && totalMissingItems > 0 && Notification.isSupported()) {
    try {
      const notif = new Notification({
        title: 'One Tap Backup Reconciler',
        body: `⚠️ ${totalMissingItems} unbacked Safar / Date items on Working Drive (${workingLetter}) need backup to ${backupLetter}!`,
        silent: false
      })

      notif.on('click', () => {
        const win = getWin ? getWin() : null
        if (win) {
          if (win.isMinimized()) win.restore()
          win.focus()
          win.webContents.send('app:navigate', 'drivesync')
        }
      })

      notif.show()
    } catch (notifErr) {
      console.error('[BackupReconciler] Failed to show notification:', notifErr)
    }
  }

  return {
    success: true,
    workingDrive: workingLetter,
    backupDrive: backupLetter,
    workingSafarRoot,
    backupSafarRoot,
    missingSafars,
    missingDateFolders,
    outOfSyncFolders,
    totalMissingItems,
    allDrives,
    timestamp: Date.now()
  }
}

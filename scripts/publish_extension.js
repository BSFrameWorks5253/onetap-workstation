#!/usr/bin/env node

/**
 * ====================================================================
 * ONE TAP — ONE-COMMAND PREMIERE PRO EXTENSION PUBLISHER
 * ====================================================================
 * Run via: npm run release:ext [-- --version 26.11.2 --notes "Summary"]
 *
 * 1. Syncs extensions/one-tap-extension -> extensions/one-tap-parent-extension.
 * 2. Bumps version.json in both extension folders and sets downloadUrl.
 * 3. Packages extensions/one-tap-extension into release/one-tap-extension.zip.
 * 4. Commits & pushes extension changes to origin/main (so raw.githubusercontent.com updates).
 * 5. Creates/updates GitHub Release `ext-v<version>` and uploads one-tap-extension.zip.
 * ====================================================================
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const { execSync, execFileSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const EXT_DIR = path.join(ROOT_DIR, 'extensions', 'one-tap-extension')
const PARENT_EXT_DIR = path.join(ROOT_DIR, 'extensions', 'one-tap-parent-extension')
const RELEASE_DIR = path.join(ROOT_DIR, 'release')
const ZIP_PATH = path.join(RELEASE_DIR, 'one-tap-extension.zip')

const GITHUB_OWNER = 'BSFrameWorks5253'
const GITHUB_REPO = 'onetap-workstation'

function log(msg) {
  console.log(`\x1b[36m[Ext Release]\x1b[0m ${msg}`)
}
function logSuccess(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`)
}
function logError(msg) {
  console.log(`\x1b[31m✖ ${msg}\x1b[0m`)
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null
}

function getGithubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim()
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()
  for (const envFile of ['.env', '.env.local', '.env.production']) {
    const p = path.join(ROOT_DIR, envFile)
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('GH_TOKEN=') || trimmed.startsWith('GITHUB_TOKEN=')) {
          const token = trimmed.split('=')[1]?.replace(/^["']|["']$/g, '').trim()
          if (token) return token
        }
      }
    }
  }
  return null
}

function bumpPatchVersion(ver) {
  const parts = String(ver || '26.11.1').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[parts.length - 1] += 1
  return parts.join('.')
}

function syncDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sPath = path.join(src, entry.name)
    const dPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      syncDir(sPath, dPath)
    } else {
      fs.copyFileSync(sPath, dPath)
    }
  }
}

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', d => chunks.push(d))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8')
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(raw), raw })
        } catch {
          resolve({ statusCode: res.statusCode, body: null, raw })
        }
      })
    })
    req.on('error', reject)
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData))
    req.end()
  })
}

async function uploadAsset(uploadUrl, filePath, assetName, token) {
  const size = fs.statSync(filePath).size
  const cleanUrl = uploadUrl.split('{')[0]
  const target = new URL(`${cleanUrl}?name=${encodeURIComponent(assetName)}`)
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: 'https:',
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: 'POST',
      headers: {
        'User-Agent': 'OneTap-Ext-Publisher',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/zip',
        'Content-Length': size,
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      const chunks = []
      res.on('data', d => chunks.push(d))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(true)
        else reject(new Error(`Upload failed (${res.statusCode}): ${Buffer.concat(chunks).toString('utf-8')}`))
      })
    })
    req.on('error', reject)
    fs.createReadStream(filePath).pipe(req)
  })
}

async function main() {
  const token = getGithubToken()
  if (!token) {
    logError('Missing GH_TOKEN or GITHUB_TOKEN in environment or .env')
    process.exit(1)
  }

  const verPath = path.join(EXT_DIR, 'version.json')
  const currentMeta = fs.existsSync(verPath) ? JSON.parse(fs.readFileSync(verPath, 'utf-8')) : {}
  const nextVersion = getArg('--version') || bumpPatchVersion(currentMeta.version)
  const notes = getArg('--notes') || `One Tap Extension v${nextVersion}`
  const tagName = `ext-v${nextVersion}`
  const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tagName}/one-tap-extension.zip`

  log(`Publishing extension v${nextVersion}...`)

  // 1. Update version.json in one-tap-extension & sync to one-tap-parent-extension
  const updatedMeta = {
    version: nextVersion,
    repoOwner: GITHUB_OWNER,
    repoName: GITHUB_REPO,
    branch: 'main',
    downloadUrl,
    releaseNotes: notes,
    updatedAt: new Date().toISOString()
  }
  fs.writeFileSync(verPath, JSON.stringify(updatedMeta, null, 2) + '\n', 'utf-8')
  syncDir(EXT_DIR, PARENT_EXT_DIR)
  logSuccess('Synced extensions/one-tap-extension -> extensions/one-tap-parent-extension')

  // 2. Zip extensions/one-tap-extension/* into release/one-tap-extension.zip
  fs.mkdirSync(RELEASE_DIR, { recursive: true })
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH)
  execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-Command', 'Compress-Archive -Path (Join-Path $args[0] "*") -DestinationPath $args[1] -Force',
    EXT_DIR, ZIP_PATH
  ], { stdio: 'inherit' })
  logSuccess(`Packaged ${ZIP_PATH}`)

  // 3. Commit & push extension changes to origin/main
  try {
    execSync('git add extensions/one-tap-extension extensions/one-tap-parent-extension', { cwd: ROOT_DIR, stdio: 'inherit' })
    execSync(`git commit -m "chore(ext): release v${nextVersion}"`, { cwd: ROOT_DIR, stdio: 'inherit' })
  } catch {
    log('No new git diff to commit (or already committed).')
  }
  execSync('git push origin main', { cwd: ROOT_DIR, stdio: 'inherit' })
  logSuccess('Pushed extension manifest & files to origin/main')

  // 4. Create or reuse GitHub Release and upload one-tap-extension.zip
  const headers = {
    'User-Agent': 'OneTap-Ext-Publisher',
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  }
  let relRes = await httpsRequest({ hostname: 'api.github.com', path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${tagName}`, method: 'GET', headers })
  let releaseData = relRes.statusCode === 200 ? relRes.body : null

  if (!releaseData) {
    const createRes = await httpsRequest({ hostname: 'api.github.com', path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`, method: 'POST', headers }, {
      tag_name: tagName,
      target_commitish: 'main',
      name: `One Tap Extension v${nextVersion}`,
      body: notes,
      draft: false,
      prerelease: false
    })
    if (createRes.statusCode < 200 || createRes.statusCode >= 300) {
      throw new Error(`Failed to create GitHub release (${createRes.statusCode}): ${createRes.raw}`)
    }
    releaseData = createRes.body
  } else {
    const existing = (releaseData.assets || []).find(a => a.name === 'one-tap-extension.zip')
    if (existing) {
      await httpsRequest({ hostname: 'api.github.com', path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/assets/${existing.id}`, method: 'DELETE', headers })
    }
  }

  await uploadAsset(releaseData.upload_url, ZIP_PATH, 'one-tap-extension.zip', token)
  logSuccess(`Published ${tagName} with one-tap-extension.zip!`)
  log(`All users will auto-update to v${nextVersion} next time Premiere Pro opens the panel.`)
}

main().catch(err => {
  logError(err.message || String(err))
  process.exit(1)
})

#!/usr/bin/env node

/**
 * ====================================================================
 * ONE TAP — AUTOMATED POST-BUILD RELEASE ORGANIZER & GITHUB PUBLISHER
 * ====================================================================
 * Automatically triggered after every build or via `npm run release`.
 * 1. Organizes Windows setup binaries version-wise:
 *    release/One Tap/V-<version>/OneTap-V-<version>.exe
 * 2. Prepares app.json, loader-config.json, and release.json.
 * 3. Syncs release files to the Anything Child App ecosystem.
 * 4. Pushes the Setup EXE directly to GitHub Releases via REST API.
 * 5. Tags and pushes git commit & release tag to GitHub repository.
 * ====================================================================
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const { execSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const GITHUB_OWNER = 'BSFrameWorks5253'
const GITHUB_REPO = 'onetap-workstation'

function log(msg) {
  console.log(`\x1b[36m[OneTap Release]\x1b[0m ${msg}`)
}

function logSuccess(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`)
}

function logWarn(msg) {
  console.log(`\x1b[33m▲ ${msg}\x1b[0m`)
}

function logError(msg) {
  console.log(`\x1b[31m✖ ${msg}\x1b[0m`)
}

function getGithubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim()
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()

  const envFiles = ['.env', '.env.local', '.env.production']
  for (const envFile of envFiles) {
    const p = path.join(ROOT_DIR, envFile)
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf-8').split('\n')
      for (const line of lines) {
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

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (d) => chunks.push(d))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const text = buffer.toString('utf-8')
        try {
          const json = JSON.parse(text)
          resolve({ statusCode: res.statusCode, headers: res.headers, body: json, raw: text })
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: null, raw: text })
        }
      })
    })

    req.on('error', (err) => reject(err))

    if (postData) {
      if (Buffer.isBuffer(postData) || typeof postData === 'string') {
        req.write(postData)
      } else {
        req.write(JSON.stringify(postData))
      }
    }
    req.end()
  })
}

async function uploadReleaseAsset(uploadUrl, assetPath, assetName, token) {
  const fileStats = fs.statSync(assetPath)
  const cleanUploadUrl = uploadUrl.split('{')[0] // remove URI template
  const targetUrl = new URL(`${cleanUploadUrl}?name=${encodeURIComponent(assetName)}`)

  return new Promise((resolve, reject) => {
    const options = {
      protocol: 'https:',
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      method: 'POST',
      headers: {
        'User-Agent': 'OneTap-Release-Publisher',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileStats.size,
        'Accept': 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (d) => chunks.push(d))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true)
        } else {
          const msg = Buffer.concat(chunks).toString('utf-8')
          reject(new Error(`Asset upload failed (${res.statusCode}): ${msg}`))
        }
      })
    })

    req.on('error', (err) => reject(err))

    const readStream = fs.createReadStream(assetPath)
    readStream.pipe(req)
  })
}

async function publishToGitHubReleases(version, exePath, releaseNotes) {
  const token = getGithubToken()
  if (!token) {
    logWarn('No GH_TOKEN or GITHUB_TOKEN detected in environment. Skipping direct REST API upload.')
    logWarn('The release will be published via Git tag push and GitHub Actions workflow.')
    return false
  }

  log(`Connecting to GitHub API for ${GITHUB_OWNER}/${GITHUB_REPO}...`)
  const tagName = `v${version}`

  try {
    // 1. Check if release already exists
    const checkRes = await httpsRequest({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${tagName}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OneTap-Release-Publisher',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })

    let releaseData = null

    if (checkRes.statusCode === 200 && checkRes.body) {
      releaseData = checkRes.body
      log(`Found existing GitHub Release for ${tagName} (ID: ${releaseData.id})`)
    } else {
      // 2. Create release if not found
      log(`Creating new GitHub Release for ${tagName}...`)
      const createRes = await httpsRequest({
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
        method: 'POST',
        headers: {
          'User-Agent': 'OneTap-Release-Publisher',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        }
      }, {
        tag_name: tagName,
        target_commitish: 'main',
        name: `One Tap v${version}`,
        body: releaseNotes,
        draft: false,
        prerelease: false
      })

      if (createRes.statusCode >= 200 && createRes.statusCode < 300) {
        releaseData = createRes.body
        logSuccess(`Created GitHub Release for ${tagName}!`)
      } else {
        throw new Error(`Failed to create release (${createRes.statusCode}): ${createRes.raw}`)
      }
    }

    if (!releaseData || !releaseData.upload_url) {
      throw new Error('Missing upload_url in GitHub release response')
    }

    // 3. Upload Setup Executable binary
    if (fs.existsSync(exePath)) {
      const assetName = path.basename(exePath)
      const existingAsset = (releaseData.assets || []).find((a) => a.name === assetName)

      if (existingAsset) {
        log(`Replacing existing asset ${assetName} on GitHub Release...`)
        await httpsRequest({
          hostname: 'api.github.com',
          path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/assets/${existingAsset.id}`,
          method: 'DELETE',
          headers: {
            'User-Agent': 'OneTap-Release-Publisher',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        })
      }

      log(`Uploading ${assetName} (${(fs.statSync(exePath).size / (1024 * 1024)).toFixed(1)} MB) to GitHub Releases...`)
      await uploadReleaseAsset(releaseData.upload_url, exePath, assetName, token)
      logSuccess(`Setup Executable successfully pushed to GitHub Releases!`)
      logSuccess(`Direct Download URL: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tagName}/${assetName}`)
    }

    // 4. Also upload latest.yml if present
    const latestYmlPath = path.join(ROOT_DIR, 'release', 'latest.yml')
    if (fs.existsSync(latestYmlPath)) {
      log('Uploading latest.yml for auto-updater...')
      await uploadReleaseAsset(releaseData.upload_url, latestYmlPath, 'latest.yml', token)
      logSuccess('latest.yml uploaded successfully.')
    }

    return true
  } catch (err) {
    logError(`GitHub Release upload failed: ${err.message}`)
    return false
  }
}

function pushGitTag(version) {
  const tagName = `v${version}`
  log(`Pushing release tag ${tagName} to GitHub remote origin...`)

  try {
    // Stage non-binary release manifests and code changes
    execSync('git add -A', {
      stdio: 'ignore',
      cwd: ROOT_DIR
    })

    const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: ROOT_DIR }).trim()
    if (status) {
      execSync(`git commit -m "chore(release): v${version}"`, { stdio: 'inherit', cwd: ROOT_DIR })
      logSuccess(`Committed release v${version} changes.`)
    }

    execSync(`git tag -a ${tagName} -m "Release v${version}" -f`, { stdio: 'inherit', cwd: ROOT_DIR })
    logSuccess(`Created git release tag: ${tagName}`)

    try {
      execSync('git push origin main', {
        stdio: 'inherit',
        cwd: ROOT_DIR,
        timeout: 15000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      })
      execSync(`git push origin ${tagName} --force`, {
        stdio: 'inherit',
        cwd: ROOT_DIR,
        timeout: 15000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      })
      logSuccess(`Successfully pushed commit & tag ${tagName} to GitHub!`)
      logSuccess(`GitHub Actions workflow is now triggered at https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`)
    } catch (pushErr) {
      logWarn(`Git push noticed: ${pushErr.message}`)
    }
  } catch (err) {
    logWarn(`Git tagging notice: ${err.message}`)
  }
}

function syncToAnythingEcosystem(version, versionDir) {
  const candidateAnythingDirs = [
    'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\New folder (2)\\Anything',
    'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\New folder (2)',
    'C:\\Users\\Burhanuddin\\OneDrive\\Desktop\\Anything'
  ]

  const targets = candidateAnythingDirs.filter((d) => fs.existsSync(d))
  if (targets.length === 0) return

  for (const anythingDir of targets) {
    const releaseTarget = path.join(anythingDir, 'releases', 'one-tap')
    const vTarget = path.join(releaseTarget, `V-${version}`)

    try {
      fs.mkdirSync(releaseTarget, { recursive: true })
      fs.mkdirSync(vTarget, { recursive: true })

      const files = fs.readdirSync(versionDir)
      for (const f of files) {
        fs.copyFileSync(path.join(versionDir, f), path.join(vTarget, f))
        fs.copyFileSync(path.join(versionDir, f), path.join(releaseTarget, f))
      }
      logSuccess(`Synced version V-${version} to Anything: ${releaseTarget}`)
    } catch (e) {
      logWarn(`Could not sync to Anything (${releaseTarget}): ${e.message}`)
    }
  }
}

async function publishRelease(options = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'))
  const version = options.version || pkg.version || '26.10.12'

  console.log('\n============================================================')
  console.log(`  ONE TAP RELEASE PUBLISHING PIPELINE: v${version}`)
  console.log('============================================================\n')

  const releaseBaseDir = path.join(ROOT_DIR, 'release', 'One Tap')
  const versionDir = path.join(releaseBaseDir, `V-${version}`)
  fs.mkdirSync(releaseBaseDir, { recursive: true })
  fs.mkdirSync(versionDir, { recursive: true })

  // 1. Search for built installer executable in release/
  const flatReleaseDir = path.join(ROOT_DIR, 'release')
  let detectedExe = null

  if (fs.existsSync(flatReleaseDir)) {
    const files = fs.readdirSync(flatReleaseDir)
    // Priority: OneTap-V-<version>.exe or any Setup .exe
    const matched = files.find((f) => f.toLowerCase() === `onetap-v-${version.toLowerCase()}.exe`)
      || files.find((f) => f.toLowerCase().includes('onetap') && f.endsWith('.exe'))
      || files.find((f) => f.toLowerCase().includes('setup') && f.endsWith('.exe'))

    if (matched) {
      detectedExe = path.join(flatReleaseDir, matched)
    }
  }

  // Target executable name strictly per Anything CHILD_APP_GUIDE standard
  const targetExeName = `OneTap-V-${version}.exe`
  const targetExePath = path.join(versionDir, targetExeName)

  if (detectedExe && fs.existsSync(detectedExe)) {
    if (detectedExe !== targetExePath) {
      fs.copyFileSync(detectedExe, targetExePath)
      logSuccess(`Organized setup executable into: release/One Tap/V-${version}/${targetExeName}`)
    }
  } else if (!fs.existsSync(targetExePath)) {
    // If not built yet, create placeholder indicator so the release folder structure is valid
    logWarn(`Executable not yet in release/. Preparing release structure for ${targetExeName}...`)
  }

  // 2. Ensure manifests exist
  const appJsonPath = path.join(releaseBaseDir, 'app.json')
  const loaderConfigPath = path.join(releaseBaseDir, 'loader-config.json')
  const logoPngPath = path.join(releaseBaseDir, 'app-logo.png')
  const releaseJsonPath = path.join(versionDir, 'release.json')

  // Copy app.json & app-logo.png to version subfolder
  if (fs.existsSync(appJsonPath)) {
    fs.copyFileSync(appJsonPath, path.join(versionDir, 'app.json'))
  }
  if (fs.existsSync(logoPngPath)) {
    fs.copyFileSync(logoPngPath, path.join(versionDir, 'app-logo.png'))
  }

  let releaseNotes = `One Tap v${version} - Automated Video Production Workstation`
  if (fs.existsSync(releaseJsonPath)) {
    try {
      const rData = JSON.parse(fs.readFileSync(releaseJsonPath, 'utf-8'))
      releaseNotes = `### ${rData.tagline || 'One Tap Release'}\n\n${rData.summary || ''}\n\n#### ✨ New Features:\n`
        + (rData.newFeatures || []).map((f) => `- ${f}`).join('\n')
        + `\n\n#### ⚡ Improvements:\n`
        + (rData.improvements || []).map((i) => `- ${i}`).join('\n')
    } catch {}
  }

  // 3. Sync to Anything Child App ecosystem
  syncToAnythingEcosystem(version, versionDir)

  // 4. Push directly to GitHub Releases via REST API
  if (fs.existsSync(targetExePath)) {
    await publishToGitHubReleases(version, targetExePath, releaseNotes)
  }

  // 5. Push Git Tag & Commit to trigger GitHub Actions release pipeline
  pushGitTag(version)

  console.log('\n============================================================')
  console.log(`🎉 RELEASE v${version} PIPELINE COMPLETED!`)
  console.log(`📁 Version Folder: release/One Tap/V-${version}/`)
  if (fs.existsSync(targetExePath)) {
    console.log(`📦 Executable    : ${targetExePath}`)
  }
  console.log(`🌐 GitHub URL    : https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v${version}`)
  console.log('============================================================\n')
}

module.exports = { publishRelease }

if (require.main === module) {
  const versionArg = process.argv.slice(2).find((a) => !a.startsWith('-'))
  publishRelease({ version: versionArg }).catch((err) => {
    console.error('[OneTap Release] Error:', err)
    process.exit(1)
  })
}

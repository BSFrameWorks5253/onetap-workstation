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

async function uploadOrReplaceAsset(releaseData, filePath, assetName, token) {
  if (!filePath || !fs.existsSync(filePath)) return

  // Query live assets list from GitHub to guarantee we have the absolute latest assets
  let assets = releaseData.assets || []
  try {
    const listRes = await httpsRequest({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/${releaseData.id}/assets`,
      method: 'GET',
      headers: {
        'User-Agent': 'OneTap-Release-Publisher',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    if (listRes.statusCode === 200 && Array.isArray(listRes.body)) {
      assets = listRes.body
    }
  } catch (e) {
    // fallback to releaseData.assets
  }

  const existingAsset = assets.find((a) => a.name === assetName)
  if (existingAsset) {
    log(`Replacing existing asset ${assetName} on GitHub Release...`)
    try {
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
      // GitHub release asset deletion requires a brief moment to propagate across replicas
      await new Promise((r) => setTimeout(r, 1500))
    } catch (delErr) {
      logWarn(`Could not delete asset ${assetName}: ${delErr.message}`)
    }
  }

  log(`Uploading ${assetName} (${(fs.statSync(filePath).size / (1024 * 1024)).toFixed(2)} MB) to GitHub Releases...`)
  try {
    await uploadReleaseAsset(releaseData.upload_url, filePath, assetName, token)
  } catch (err) {
    // If it failed with 422 already_exists, do one retry with explicit delete
    if (err.message && err.message.includes('already_exists')) {
      logWarn(`Asset ${assetName} was still flagged as existing. Retrying clean replacement...`)
      try {
        await new Promise((r) => setTimeout(r, 2000))
        const retryListRes = await httpsRequest({
          hostname: 'api.github.com',
          path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/${releaseData.id}/assets`,
          method: 'GET',
          headers: {
            'User-Agent': 'OneTap-Release-Publisher',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        })
        if (retryListRes.statusCode === 200 && Array.isArray(retryListRes.body)) {
          const match = retryListRes.body.find((a) => a.name === assetName)
          if (match) {
            await httpsRequest({
              hostname: 'api.github.com',
              path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/assets/${match.id}`,
              method: 'DELETE',
              headers: {
                'User-Agent': 'OneTap-Release-Publisher',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            })
            await new Promise((r) => setTimeout(r, 1500))
          }
        }
        await uploadReleaseAsset(releaseData.upload_url, filePath, assetName, token)
      } catch (retryErr) {
        throw new Error(`Asset upload retry failed for ${assetName}: ${retryErr.message}`)
      }
    } else {
      throw err
    }
  }
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

    // 3. Upload Executable binaries (both Setup and standard artifacts)
    const filesToUpload = Array.isArray(exePath) ? exePath : [exePath]
    for (const file of filesToUpload) {
      if (file && fs.existsSync(file)) {
        const assetName = path.basename(file)
        await uploadOrReplaceAsset(releaseData, file, assetName, token)
        logSuccess(`Executable ${assetName} successfully pushed to GitHub Releases!`)
        logSuccess(`Direct Download URL: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tagName}/${assetName}`)
      }
    }

    // 4. Also upload latest.yml if present (with duplicate replacement protection)
    const latestYmlPath = path.join(ROOT_DIR, 'release', 'latest.yml')
    if (fs.existsSync(latestYmlPath)) {
      log('Uploading latest.yml for auto-updater...')
      try {
        await uploadOrReplaceAsset(releaseData, latestYmlPath, 'latest.yml', token)
        logSuccess('latest.yml uploaded successfully.')
      } catch (ymlErr) {
        logWarn(`Could not upload latest.yml: ${ymlErr.message}`)
      }
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

    const token = getGithubToken()
    const pushRemote = token
      ? `https://${token}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`
      : 'origin'

    try {
      execSync(`git push ${pushRemote} main --force`, {
        stdio: 'inherit',
        cwd: ROOT_DIR,
        timeout: 30000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      })
      execSync(`git push ${pushRemote} ${tagName} --force`, {
        stdio: 'inherit',
        cwd: ROOT_DIR,
        timeout: 30000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      })
      logSuccess(`Successfully pushed commit & tag ${tagName} to GitHub!`)
      logSuccess(`GitHub Actions workflow is now triggered at https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`)
      return true
    } catch (pushErr) {
      logWarn(`Git push to GitHub skipped/failed: ${pushErr.message}`)
      logWarn(`To enable automatic git pushing, save your GitHub token in .env as GITHUB_TOKEN="ghp_..."`)
      return false
    }
  } catch (err) {
    logWarn(`Git tagging notice: ${err.message}`)
    return false
  }
}

function syncToAnythingEcosystem(version, versionDir) {
  const ecosystemRoot = path.resolve(ROOT_DIR, '..', '..');
  const appData = process.env.APPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : '');

  const targets = [
    path.join(ecosystemRoot, 'Anything Child app realse', 'one-tap', `V${version}`),
    path.join(ecosystemRoot, 'Anything Child app realse', 'one-tap', `V-${version}`),
    path.join(ecosystemRoot, 'Anything', 'releases', 'one-tap', `V-${version}`),
    path.join(ecosystemRoot, 'Anything', 'published-apps', 'one-tap'),
    appData ? path.join(appData, 'Anything', 'published-apps', 'one-tap') : '',
  ].filter(Boolean);

  for (const t of targets) {
    try {
      fs.mkdirSync(t, { recursive: true });
      const files = fs.readdirSync(versionDir);
      for (const f of files) {
        fs.copyFileSync(path.join(versionDir, f), path.join(t, f));
      }
      logSuccess(`Synced version v${version} to: ${t}`);
    } catch (e) {
      logWarn(`Could not sync to ${t}: ${e.message}`);
    }
  }

  // Synchronize catalog.json so Anything desktop immediately recognizes new version & setup executable
  const setupExeName = `OneTap-Setup-V-${version}.exe`;
  const canonicalPkgPath = path.join(ecosystemRoot, 'Anything Child app realse', 'one-tap', `V${version}`, setupExeName);

  const catalogTargets = [
    path.join(ecosystemRoot, 'Anything', 'published-apps', 'catalog.json'),
    appData ? path.join(appData, 'Anything', 'published-apps', 'catalog.json') : ''
  ].filter(Boolean);

  for (const cp of catalogTargets) {
    if (fs.existsSync(cp)) {
      try {
        const cat = JSON.parse(fs.readFileSync(cp, 'utf-8'));
        if (Array.isArray(cat)) {
          const entry = cat.find((a) => a.id === 'one-tap');
          if (entry) {
            entry.version = version;
            entry.versionText = `V${version}`;
            entry.executableName = setupExeName;
            entry.setupExecutableName = setupExeName;
            entry.packageFileName = setupExeName;
            entry.localPackagePath = canonicalPkgPath;
            entry.downloadUrl = canonicalPkgPath;
            if (entry.releaseInfo) {
              entry.releaseInfo.version = version;
              entry.releaseInfo.executableName = setupExeName;
              entry.releaseInfo.downloadUrl = canonicalPkgPath;
            }
            fs.writeFileSync(cp, JSON.stringify(cat, null, 2), 'utf-8');
            logSuccess(`Updated catalog ${cp} with One Tap v${version}`);
          }
        }
      } catch (err) {
        logWarn(`Could not update catalog ${cp}: ${err.message}`);
      }
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

  // Target executable name strictly per Anything CHILD_APP_GUIDE standard
  const targetExeName = `OneTap-V-${version}.exe`
  const setupExeName = `OneTap-Setup-V-${version}.exe`
  const flatTargetPath = path.join(flatReleaseDir, targetExeName)
  const flatSetupPath = path.join(flatReleaseDir, setupExeName)
  const targetExePath = path.join(versionDir, targetExeName)
  const setupExePath = path.join(versionDir, setupExeName)

  let builtExe = null

  if (fs.existsSync(flatSetupPath)) {
    builtExe = flatSetupPath
  } else if (fs.existsSync(flatTargetPath)) {
    builtExe = flatTargetPath
  } else if (fs.existsSync(flatReleaseDir)) {
    const files = fs.readdirSync(flatReleaseDir)
    // ONLY match executables that strictly contain the target version string!
    const versionMatch = files.find((f) => f.toLowerCase().includes(version.toLowerCase()) && f.endsWith('.exe'))
    if (versionMatch) {
      builtExe = path.join(flatReleaseDir, versionMatch)
    }
  }

  if (builtExe && fs.existsSync(builtExe)) {
    fs.copyFileSync(builtExe, setupExePath)
    logSuccess(`Organized setup into: release/One Tap/V-${version}/${setupExeName}`)
    fs.copyFileSync(builtExe, targetExePath)
    logSuccess(`Organized executable alias into: release/One Tap/V-${version}/${targetExeName}`)
  } else {
    logWarn(`No executable matching version v${version} found in release/. Preparing release structure for ${targetExeName}...`)
  }

  // 2. Ensure manifests exist
  const appJsonPath = path.join(releaseBaseDir, 'app.json')
  const loaderConfigPath = path.join(releaseBaseDir, 'loader-config.json')
  const logoPngPath = path.join(releaseBaseDir, 'app-logo.png')
  const releaseJsonPath = path.join(versionDir, 'release.json')

  // Update & write app.json with current version & executable info
  let appJson = {}
  if (fs.existsSync(appJsonPath)) {
    try {
      appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'))
    } catch {}
  }
  appJson.id = appJson.id || 'one-tap'
  appJson.name = appJson.name || 'One Tap'
  appJson.version = version
  appJson.versionText = `V${version}`
  appJson.executableName = setupExeName
  appJson.setupExecutableName = setupExeName
  appJson.packageFileName = setupExeName
  if (builtExe && fs.existsSync(builtExe)) {
    appJson.size = `${(fs.statSync(builtExe).size / (1024 * 1024)).toFixed(1)} MB`
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), 'utf-8')
  fs.writeFileSync(path.join(versionDir, 'app.json'), JSON.stringify(appJson, null, 2), 'utf-8')

  if (fs.existsSync(logoPngPath)) {
    try { fs.copyFileSync(logoPngPath, path.join(versionDir, 'app-logo.png')) } catch {}
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
  let githubApiUploaded = false
  const exesToUpload = [targetExePath, setupExePath].filter((p) => p && fs.existsSync(p))
  const uniqueExes = [...new Set(exesToUpload)]
  if (uniqueExes.length > 0) {
    githubApiUploaded = await publishToGitHubReleases(version, uniqueExes, releaseNotes)
  }

  // 5. Push Git Tag & Commit to trigger GitHub Actions release pipeline
  const gitPushed = pushGitTag(version)

  console.log('\n============================================================')
  if (githubApiUploaded || gitPushed) {
    console.log(`🎉 RELEASE v${version} PUBLISHED TO GITHUB!`)
    console.log(`🌐 GitHub URL    : https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v${version}`)
  } else {
    console.log(`⚠️  LOCAL RELEASE V-${version} PACKAGED (GITHUB UPLOAD SKIPPED)`)
    console.log(`▲ Note: No GITHUB_TOKEN configured. The files are packaged locally, but not yet uploaded to GitHub Releases.`)
    console.log(`▲ To publish to GitHub, add GITHUB_TOKEN="ghp_..." in .env and run: node scripts/publish_release.js`)
  }
  console.log(`📁 Version Folder: release/One Tap/V-${version}/`)
  if (fs.existsSync(targetExePath)) {
    console.log(`📦 Executable    : ${targetExePath}`)
  }
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

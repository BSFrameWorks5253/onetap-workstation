const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

/**
 * Generates Microsoft Store / Windows 10 & 11 AppX/MSIX tile assets
 * according to official Microsoft UWP / electron-builder specifications.
 */
async function generateAppxAssets() {
  const rootDir = path.resolve(__dirname, '..')
  const srcIcon = path.join(rootDir, 'resources', 'icon.png')
  const targetDir = path.join(rootDir, 'build', 'appx')
  const resourcesAppxDir = path.join(rootDir, 'resources', 'appx')

  if (!fs.existsSync(srcIcon)) {
    console.error(`[MSIX Assets] Error: Source icon not found at ${srcIcon}`)
    return false
  }

  [targetDir, resourcesAppxDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })

  console.log('[MSIX Assets] Generating professional Windows 10/11 MSIX tile & splash assets...')

  const assetConfigs = [
    { name: 'Square44x44Logo.png', width: 44, height: 44, paddingPct: 0.1, bg: { r: 12, g: 16, b: 23, alpha: 0 } },
    { name: 'Square71x71Logo.png', width: 71, height: 71, paddingPct: 0.1, bg: { r: 12, g: 16, b: 23, alpha: 0 } },
    { name: 'Square150x150Logo.png', width: 150, height: 150, paddingPct: 0.12, bg: { r: 12, g: 16, b: 23, alpha: 0 } },
    { name: 'Square310x310Logo.png', width: 310, height: 310, paddingPct: 0.12, bg: { r: 12, g: 16, b: 23, alpha: 0 } },
    { name: 'StoreLogo.png', width: 50, height: 50, paddingPct: 0.08, bg: { r: 12, g: 16, b: 23, alpha: 0 } },
    { name: 'BadgeLogo.png', width: 24, height: 24, paddingPct: 0.05, bg: { r: 12, g: 16, b: 23, alpha: 0 } },
    { name: 'Wide310x150Logo.png', width: 310, height: 150, paddingPct: 0.15, bg: { r: 12, g: 16, b: 23, alpha: 1 } },
    { name: 'SplashScreen.png', width: 620, height: 300, paddingPct: 0.25, bg: { r: 12, g: 16, b: 23, alpha: 1 } }
  ]

  for (const config of assetConfigs) {
    const iconMaxDim = Math.round(Math.min(config.width, config.height) * (1 - config.paddingPct * 2))
    
    // Resize icon
    const resizedIconBuffer = await sharp(srcIcon)
      .resize(iconMaxDim, iconMaxDim, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer()

    // Composite onto background canvas
    const finalBuffer = await sharp({
      create: {
        width: config.width,
        height: config.height,
        channels: 4,
        background: config.bg
      }
    })
      .composite([{ input: resizedIconBuffer, gravity: 'center' }])
      .png()
      .toBuffer()

    // Write to both build/appx and resources/appx
    fs.writeFileSync(path.join(targetDir, config.name), finalBuffer)
    fs.writeFileSync(path.join(resourcesAppxDir, config.name), finalBuffer)
    console.log(`  ✔ Generated: ${config.name} (${config.width}x${config.height})`)
  }

  console.log('[MSIX Assets] All professional Store assets successfully created in build/appx/ and resources/appx/.')
  return true
}

if (require.main === module) {
  generateAppxAssets().catch((err) => {
    console.error('[MSIX Assets] Generation failed:', err)
    process.exit(1)
  })
}

module.exports = { generateAppxAssets }
